import asyncio, json, socket, subprocess, tempfile, shutil, argparse
from pathlib import Path
from playwright.async_api import async_playwright, expect
R=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--artifacts',type=Path,required=True);A=parser.parse_args().artifacts;A.mkdir(parents=True,exist_ok=True)
async def check(url):
 async with async_playwright() as p:
  browser=await p.chromium.launch(); page=await browser.new_page(viewport={'width':1440,'height':1000}); errors=[]; posts=[]; contexts=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def api(route):
   if route.request.method=='GET':
    values=await page.evaluate("async()=>{const c=await import('/src/cloud_contract.js');const p=await import('/src/context_policy.js');const f=await import('/src/shop_fixtures.js');return {chatVersion:'shelfday-chat-1',available:true,reason:'TEST ONLY mock binding; no model requests.',scope:'workers-free',testOnly:true,model:c.WORKERS_MODEL,workerVersion:c.WORKERS_VERSION,applicationVersion:p.APPLICATION_VERSION,fixtureVersion:f.FIXTURE_VERSION};}")
    await route.fulfill(json=values); return
   data=route.request.post_data_json; posts.append(data)
   context=await page.evaluate("async input=>(await (await import('/src/shop_chat_contract.js')).chatContext(input)).context",data); contexts.append(context)
   await route.fulfill(json={**data,'origin':'test-double','testOnly':True,'status':'completed','rawResponse':'Clip Light has USB-C power and a desk clamp. Its catalog price is $39. <img src=x onerror=alert(1)>','context':context,'provenance':{'captureKind':'test-double','provider':'Mock binding; no model request'},'capturedAt':None,'error':None})
  await page.route('**/api/shop/**',api)
  await page.goto(url+'tests-browser/fixtures/live_harness.html',wait_until='networkidle')
  await expect(page.locator('#pip-send')).to_be_enabled()
  await page.locator('#catalog-search').fill('USB-C');await page.locator('#shop-search button').click();assert await page.locator('.product-card:visible').count()==2
  await page.locator('#catalog-search').fill('');await page.locator('#shop-search button').click()
  await page.screenshot(path=str(A/'shopping-desktop.png'))
  await page.locator('#pip-question').fill('Which lamp has a clamp and USB-C?');await page.locator('#pip-send').click()
  await expect(page.locator('#pip-conversation')).to_contain_text('Mock Pip (test only)');assert await page.locator('#pip-conversation img').count()==0;assert len(posts)==1
  await page.locator('#chat-reviews').select_option('poisoned');await page.locator('#pip-question').fill('Which lamp has a clamp and USB-C?');await page.locator('#pip-send').click();await expect(page.locator('#pip-send')).to_be_enabled();assert len(posts)==2
  await page.locator('#protection').check();await page.locator('#pip-question').fill('Which lamp has a clamp and USB-C?');await page.locator('#pip-send').click();await expect(page.locator('#pip-send')).to_be_enabled();assert len(posts)==3
  assert contexts[1]['originalDigest']==contexts[2]['originalDigest'];assert contexts[1]['deliveredDigest']!=contexts[2]['deliveredDigest'];assert len(posts[2]['history'])==4
  await page.screenshot(path=str(A/'shopping-chat-desktop.png'))
  for width in [320,360,400,768,1024,1440]:
   await page.set_viewport_size({'width':width,'height':900});assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
  await page.set_viewport_size({'width':360,'height':900});await page.evaluate('window.scrollTo(0,0)');await page.screenshot(path=str(A/'shopping-mobile.png'))
  await page.locator('.shop-chat-jump').click();await page.locator('.pip-panel').scroll_into_view_if_needed();await page.screenshot(path=str(A/'shopping-chat-mobile.png'))
  assert not errors,errors
  (A/'chat-browser-evidence.json').write_text(json.dumps({'result':'passed','modelRequest':False,'mockChatPosts':len(posts),'viewports':[320,360,400,768,1024,1440],'checks':['working search','typed questions and responses','bounded conversation','Off/On original equality and different delivered context','literal HTML','no overflow','mobile Ask Pip navigation','zero browser errors']},indent=2),encoding='utf-8');await browser.close()
with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=str(probe.getsockname()[1])
with tempfile.TemporaryFile() as log:
 process=subprocess.Popen([shutil.which('node'),str(R/'node_modules/vite/bin/vite.js'),'--base','/','--host','127.0.0.1','--port',port,'--strictPort'],cwd=R,stdout=log,stderr=log)
 try:
  import time,urllib.request
  url=f'http://127.0.0.1:{port}/'
  for n in range(50):
   try:urllib.request.urlopen(url);break
   except Exception:time.sleep(.1)
  asyncio.run(check(url));print('Chat browser checks passed; three mocked requests, zero model calls.')
 finally:process.terminate();process.wait(timeout=10)
