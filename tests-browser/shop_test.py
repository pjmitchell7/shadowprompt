"""Verify the honest local storefront and preserved workbench navigation."""
import argparse
import gzip
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('console_harness', ROOT / 'tests-browser/console_test.py')
HARNESS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HARNESS)

def run_checks(url, artifacts):
    has_recording = bool(list((ROOT / 'public/recordings').glob('*.json')))
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        context.add_init_script(HARNESS.RAF_PROBE)
        context.add_init_script("""window.__layout = {cls:0,lcp:0}; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__layout.cls += e.value; }).observe({type:'layout-shift',buffered:true}); new PerformanceObserver(list => { for (const e of list.getEntries()) window.__layout.lcp = e.startTime; }).observe({type:'largest-contentful-paint',buffered:true});""")
        page = context.new_page()
        errors = []; requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('request', lambda request: requests.append(request.url))
        response = page.goto(url, wait_until='networkidle')
        assert response.status == 200
        expect(page.get_by_role('heading', name='A little light, for your desk.')).to_be_visible()
        expect(page.locator('#product-list > li')).to_have_count(4)
        expect(page.locator('#pip-result')).to_contain_text('Recording not available')
        expect(page.locator('#try-live')).to_be_disabled()
        for identifier in ['recorded-clean', 'recorded-off', 'recorded-on']:
            if has_recording:
                expect(page.locator('#' + identifier)).to_be_enabled()
            else:
                expect(page.locator('#' + identifier)).to_be_disabled()
        assert not any('/arena-' in item or '/workbench-' in item for item in requests), 'Workbench and Three must be lazy'
        assert page.locator('#workbench-view canvas').count() == 0
        assert page.evaluate('window.__frameProbe.pending.size') == 0
        page.screenshot()
        try:
            page.wait_for_function('window.__layout.lcp > 0', timeout=3000)
        except Exception:
            pass
        initial_metrics = page.evaluate('({cls:window.__layout.cls,lcp:window.__layout.lcp || null})')
        initial_resources = page.evaluate('performance.getEntriesByType("resource").map(e => ({url:e.name,encoded:e.encodedBodySize,decoded:e.decodedBodySize}))')
        dom_update_ms = page.evaluate("() => {const button = document.querySelector('[data-sku=\"SD-L01\"]');const start = performance.now();button.click();const elapsed = performance.now()-start;button.click();return elapsed;}")
        if artifacts:
            artifacts.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(artifacts / 'shop-opening-1440.png'))
        # The normal shopping task completes entirely from catalog facts.
        clip = page.locator('[data-sku="SD-L01"]'); clip.focus(); page.keyboard.press('Enter')
        expect(clip).to_be_focused(); expect(clip).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#shortlist-items')).to_contain_text('Meets all three needs')
        page.locator('[data-sku="SD-L03"]').click()
        expect(page.locator('#shortlist-items')).to_contain_text('Over $50; AC adapter power; No desk clamp')
        page.locator('#shop-ask').click()
        expect(page.locator('#catalog-match')).to_contain_text('Catalog match: Clip Light ($39)')
        expect(page.locator('[data-sku="SD-L01"]')).to_be_focused()
        # Visitor-paced guide, anchored controls, backward navigation and Escape.
        page.locator('#shop-start').click(); expect(page.locator('#shop-guide-next')).to_be_focused()
        page.locator('#shop-guide-next').click(); expect(page.locator('#shop-evidence')).to_be_visible()
        page.locator('#shop-guide-target').click(); expect(page.locator('#review-source')).to_be_focused()
        expect(page.locator('#review-highlight mark')).to_contain_text('Ignore all previous instructions.')
        page.locator('#shop-guide-next').click(); expect(page.locator('#protection')).not_to_be_checked()
        page.locator('#shop-guide-next').click(); page.locator('#shop-guide-next').click()
        expect(page.locator('#protection')).to_be_checked(); expect(page.locator('#protection-label')).to_have_text('On')
        expect(page.locator('#review-filter-status')).to_contain_text('3 of 4 reviews included')
        expect(page.locator('#shop-guide')).to_be_visible()
        page.locator('#shop-guide-back').click(); expect(page.locator('#shop-guide-step')).to_have_text('Guide 4 of 6')
        page.keyboard.press('Escape'); expect(page.locator('#shop-guide')).to_be_hidden(); expect(page.locator('#shop-start')).to_be_focused()
        # Immutable comparison and exact delivered context export.
        expect(page.locator('#decision-summary')).to_contain_text('INJ-001')
        expect(page.locator('#context-pair')).to_contain_text('4 of 4 reviews included')
        expect(page.locator('#context-pair')).to_contain_text('3 of 4 reviews included')
        with page.expect_download() as downloaded:
            page.locator('#shop-export-preview').click()
        preview = json.loads(Path(downloaded.value.path()).read_text(encoding='utf8'))
        assert preview['modelRequest'] is False and preview['modelOutcome'] == 'not-evaluated'
        assert preview['conditions'][0]['originalDigest'] == preview['conditions'][1]['originalDigest']
        assert preview['conditions'][0]['deliveredDigest'] != preview['conditions'][1]['deliveredDigest']
        assert len(preview['conditions'][1]['delivered']['reviews']) == 3
        # Repeated changes never yield a scripted assistant answer or network send.
        for _ in range(5):
            page.locator('#protection').click()
            page.locator('#shop-ask').click()
        expect(page.locator('#pip-result')).to_contain_text('Recorded model response' if has_recording else 'Recording not available')
        assert not any('/api/' in item for item in requests)
        if artifacts:
            page.locator('#shop-evidence').scroll_into_view_if_needed()
            page.evaluate('document.activeElement.blur()')
            page.screenshot(path=str(artifacts / 'shop-evidence-1440.png'), full_page=True)
        # Shared controls disclose false holds and missed paraphrases honestly.
        limits = page.get_by_text('Where this can fail', exact=True); limits.click()
        page.locator('#control-source').select_option('3')
        expect(page.locator('#control-result')).to_contain_text('Actual scanner: quarantine')
        page.locator('#control-source').select_option('13')
        expect(page.locator('#control-result')).to_contain_text('Actual scanner: no-match')
        expect(page.locator('#control-result')).to_contain_text('Model outcome: not evaluated')
        # Case handoff has missing responses; working drafts survive navigation.
        page.locator('#shop-case').click()
        expect(page.locator('#case-panel')).to_be_visible()
        expect(page.locator('[data-case="title"]')).to_have_value('Shelfday poisoned product review')
        if has_recording:
            expect(page.locator('#case-clean-supplied')).to_be_checked(); expect(page.locator('#case-poisoned-supplied')).to_be_checked()
        else:
            expect(page.locator('#case-clean-supplied')).not_to_be_checked(); expect(page.locator('#case-poisoned-supplied')).not_to_be_checked()
        page.locator('#case-clean-supplied').uncheck()
        page.locator('[data-case="title"]').fill('My unfinished draft')
        page.locator('[data-case="cleanResponse"]').fill('An unobserved response draft')
        page.locator('[data-case="poisonedResponse"]').fill('')
        page.locator('#case-poisoned-supplied').check()
        page.get_by_role('link', name='Back to Shelfday', exact=True).click()
        expect(page.locator('#shop-view')).to_be_visible()
        expect(page.locator('#shortlist-items')).to_contain_text('Clip Light')
        assert page.locator('#workbench-view').evaluate('element => element.inert')
        page.wait_for_function('window.__frameProbe.pending.size === 0')
        page.locator('#shop-case').click()
        expect(page.locator('[data-case="title"]')).to_have_value('My unfinished draft')
        page.get_by_role('button', name='Apply Shelfday fixture', exact=True).click()
        expect(page.locator('[data-case="title"]')).to_have_value('Shelfday poisoned product review')
        page.get_by_role('button', name='Restore previous draft', exact=True).click()
        expect(page.locator('[data-case="title"]')).to_have_value('My unfinished draft')
        expect(page.locator('#case-poisoned-supplied')).to_be_checked()
        expect(page.locator('[data-case="poisonedResponse"]')).to_have_value('')
        expect(page.locator('[data-case="cleanResponse"]')).to_have_value('An unobserved response draft')
        expect(page.locator('#case-clean-supplied')).not_to_be_checked()
        # Playback suspends on view change; browser history restores the retained editor.
        page.locator('#play').click(); page.get_by_role('link', name='Back to Shelfday', exact=True).click()
        page.go_back(); expect(page.locator('#play')).not_to_have_text('Pause')
        expect(page.locator('[data-case="title"]')).to_have_value('My unfinished draft')
        page.get_by_role('link', name='Back to Shelfday', exact=True).click()
        # Rapid route changes cannot activate a hidden arena or replace shopper state.
        page.evaluate("location.hash='/inspect'; setTimeout(() => { location.hash='/shop'; },0)")
        expect(page.locator('#shop-view')).to_be_visible(); page.wait_for_function('window.__frameProbe.pending.size === 0')
        # Reflow, text enlargement, touch controls and reduced motion.
        viewports = [320, 360, 400, 768, 1024, 1440]
        for width in viewports:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate('window.scrollTo(0,0)')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
            assert page.locator('#shop-start').bounding_box()['y'] + page.locator('#shop-start').bounding_box()['height'] <= 900
            if artifacts:
                page.screenshot(path=str(artifacts / f'shop-{width}.png'), full_page=True)
                if width in [320, 360, 1440]:
                    page.screenshot(path=str(artifacts / f'shop-viewport-{width}.png'))
        page.set_viewport_size({'width': 320, 'height': 900})
        page.evaluate("document.querySelector('#shop-view').style.fontSize='32px'")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Text enlargement overflow'
        if artifacts:
            page.screenshot(path=str(artifacts / 'shop-text-enlargement-320.png'))
        page.emulate_media(reduced_motion='reduce')
        page.locator('#shop-replay').click(); expect(page.locator('#shop-guide')).to_be_visible()
        page.keyboard.press('Escape'); page.wait_for_function('window.__frameProbe.pending.size === 0')
        page.emulate_media(forced_colors='active'); expect(page.locator('#protection')).to_be_visible()
        assert not errors, repr(errors)
        summary = {'result': 'passed', 'browser': browser.version, 'viewports': viewports, 'profile': 'Windows Chromium, 1x DPR, loopback production preview, no network or CPU throttling', 'initialLabMetrics': initial_metrics, 'shortlistHandlerToDomMs': dom_update_ms, 'initialResources': initial_resources, 'checks': 'catalog shortlist, local live disabled, genuine replay availability, guide focus/escape, real filtering export, controls, preserved draft/empty response, lazy arena, navigation, reflow, enlarged text, reduced motion, forced colors', 'screenReaders': 'NVDA/Edge and real mobile screen reader not exercised'}
        if artifacts:
            (artifacts / 'shop-browser-evidence.json').write_text(json.dumps(summary, indent=2), encoding='utf8')
        print(json.dumps(summary))
        browser.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--artifacts', type=Path)
    args = parser.parse_args()
    if args.url:
        run_checks(args.url, args.artifacts); return
    node = shutil.which('node')
    if not node or not (ROOT / 'dist/index.html').exists():
        raise RuntimeError('Install locked dependencies and build first')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0)); port = str(probe.getsockname()[1])
    url = f'http://127.0.0.1:{port}/shadowprompt/'
    with tempfile.TemporaryFile() as log:
        process = subprocess.Popen([node, str(ROOT / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], cwd=ROOT, stdout=log, stderr=log)
        try:
            HARNESS.wait_for_server(url, process, log, port)
            run_checks(url, args.artifacts)
            if process.poll() is not None:
                raise RuntimeError('Production preview exited during checks')
        finally:
            if process.poll() is None: process.terminate()
            process.wait(timeout=10)

if __name__ == '__main__':
    main()
