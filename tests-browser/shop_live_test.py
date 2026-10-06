"""Local source-browser test. Every response is explicitly test-double data."""
import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('shop_harness', ROOT / 'tests-browser/console_test.py')
HARNESS = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(HARNESS)

async def checks(url, fixtures, artifacts):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width':1440,'height':1000})
        scenario = {'group':'complete','tamper':False,'slow':False}; posts=[]; errors=[]; release=asyncio.Event()
        page.on('pageerror', lambda error: errors.append(str(error)))
        async def api(route):
            if route.request.method == 'GET':
                await route.fulfill(json=fixtures[scenario['group']]['status']); return
            body = route.request.post_data_json; posts.append(body)
            if scenario['slow']: await release.wait()
            item = copy.deepcopy(fixtures[scenario['group']]['conditions'][body['condition']])
            if 'run' in item['body']:
                item['body']['runId'] = body['runId']; item['body']['run']['attemptId'] = body['runId']
                if scenario['tamper']: item['body']['run']['deliveredDigest'] = 'corrupt'
            try: await route.fulfill(status=item['http'], json=item['body'])
            except Exception:
                if not scenario['slow']: raise
        await page.route('**/api/shop/**', api)
        fixture_url = url + 'tests-browser/fixtures/live_harness.html'
        await page.goto(fixture_url, wait_until='networkidle')
        await page.locator('#model-controls > summary').click()
        await expect(page.locator('#try-live')).to_be_enabled()
        await expect(page.get_by_role('link', name='Llama 3.1 license')).to_have_attribute('href', 'https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE')
        assert len(posts)==0
        await page.locator('#try-live').click(); await expect(page.locator('#live-run')).to_be_focused(); assert len(posts)==0
        await page.locator('#live-run').click(); await expect(page.locator('#pip-result')).to_contain_text('Mock comparison returned')
        await expect(page.locator('#pip-result .mock-notice')).to_contain_text('No real model request')
        await expect(page.locator('#pip-result')).to_contain_text('<img src=x onerror=alert(1)>')
        assert await page.locator('#pip-result img').count()==0
        assert [item['condition'] for item in posts]==['clean','poisoned-off','poisoned-on']
        await page.locator('#live-condition').select_option('poisoned-off'); await expect(page.locator('#pip-result')).to_contain_text('Task check: fail')
        await page.locator('#live-condition').select_option('poisoned-on'); assert len(posts)==3
        await page.locator('#pip-result summary').filter(has_text='Capture provenance').click()
        await expect(page.locator('#pip-result')).to_contain_text('test-double')
        async with page.expect_download() as event:
            await page.locator('#shop-export-trial').click()
        downloaded = await event.value; value=json.loads(Path(await downloaded.path()).read_text(encoding='utf8'))
        assert value['conditions'][1]['originalDigest']==value['conditions'][2]['originalDigest']
        assert value['conditions'][1]['deliveredDigest']!=value['conditions'][2]['deliveredDigest']
        assert all(item['provenance']['captureKind']=='test-double' for item in value['conditions'])
        await page.locator('#pip-result').scroll_into_view_if_needed()
        await page.screenshot(path=str(artifacts/'mock-live-desktop.png'))
        await page.set_viewport_size({'width':320,'height':900})
        await page.locator('#live-controls').scroll_into_view_if_needed()
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.screenshot(path=str(artifacts/'mock-live-mobile.png'))
        # Quota shows actual returns only, stops On, and offers an honest partial export.
        scenario['group']='quota'; posts.clear()
        await page.goto(fixture_url, wait_until='networkidle'); await page.locator('#model-controls > summary').click(); await page.locator('#try-live').click(); await page.locator('#live-run').click()
        await expect(page.locator('#pip-result')).to_contain_text('Free allowance exhausted'); assert len(posts)==2
        await expect(page.locator('#live-run')).to_be_disabled()
        async with page.expect_download() as event:
            await page.locator('#shop-export-partial').click()
        downloaded = await event.value; partial=json.loads(Path(await downloaded.path()).read_text(encoding='utf8'))
        assert partial['notRequested']==['poisoned-on']; assert len(partial['captures'])==2; assert partial['modelRequest'] is False
        await page.locator('#pip-result').scroll_into_view_if_needed(); await page.screenshot(path=str(artifacts/'mock-quota-mobile.png'))
        # Invalid evidence never gets a model-output caption or complete trial.
        scenario.update(group='complete',tamper=True); posts.clear()
        await page.goto(fixture_url, wait_until='networkidle'); await page.locator('#model-controls > summary').click(); await page.locator('#try-live').click(); await page.locator('#live-run').click()
        await expect(page.locator('#pip-result')).to_contain_text('Delivered context'); assert len(posts)==1
        await expect(page.locator('#shop-export-trial')).to_be_hidden()
        # Cancel waiting, then let the ignored response arrive; no next arm is sent.
        scenario.update(tamper=False,slow=True); posts.clear()
        await page.goto(fixture_url, wait_until='networkidle'); await page.locator('#model-controls > summary').click(); await page.locator('#try-live').click(); await page.locator('#live-run').click()
        await expect(page.locator('#live-cancel')).to_be_visible(); await page.locator('#live-cancel').click()
        await expect(page.locator('#pip-result')).to_contain_text('Stopped waiting'); release.set(); await page.wait_for_timeout(100)
        assert len(posts)==1; await expect(page.locator('#pip-result')).not_to_contain_text('Mock comparison returned')
        # Production mode rejects a test-only readiness response before POST.
        scenario['slow']=False; posts.clear()
        await page.goto(fixture_url+'?production-guard=1', wait_until='networkidle'); await expect(page.locator('#try-live')).to_be_disabled(); assert len(posts)==0
        assert not errors, errors
        result={'result':'passed','modelRequest':False,'browser':browser.version,'checks':'test-only complete/provenance/export, exact Off/On originals/settings, selection without calls, inert raw HTML, mobile reflow, quota partial export, corrupt evidence rejection, cancellation/late guards, production mock rejection'}
        (artifacts/'mock-live-browser-evidence.json').write_text(json.dumps(result,indent=2),encoding='utf8'); print(json.dumps(result))
        await browser.close()

def main():
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument('--artifacts',type=Path,required=True); args=parser.parse_args(); args.artifacts.mkdir(parents=True,exist_ok=True)
    fixtures_path=args.artifacts/'private-test-only-responses.json'
    subprocess.run([shutil.which('node'),str(ROOT/'tests-js/make_live_mock_fixtures.mjs'),str(fixtures_path)],cwd=ROOT,check=True)
    fixtures=json.loads(fixtures_path.read_text(encoding='utf8'))
    with socket.socket() as probe: probe.bind(('127.0.0.1',0)); port=str(probe.getsockname()[1])
    url=f'http://127.0.0.1:{port}/'
    with tempfile.TemporaryFile() as log:
        process=subprocess.Popen([shutil.which('node'),str(ROOT/'node_modules/vite/bin/vite.js'),'--base','/','--host','127.0.0.1','--port',port,'--strictPort'],cwd=ROOT,stdout=log,stderr=log)
        try:
            HARNESS.wait_for_server(url,process,log,port); asyncio.run(checks(url,fixtures,args.artifacts))
        finally:
            process.terminate(); process.wait(timeout=10)
if __name__=='__main__': main()
