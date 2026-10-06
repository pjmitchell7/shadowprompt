import '../css/style.css';
import '../css/shop.css';
import { mountShop } from './shop.js';

const app = document.querySelector('#app');
const shopView = document.createElement('div'); shopView.id = 'shop-view';
const workbenchView = document.createElement('div'); workbenchView.id = 'workbench-view'; workbenchView.hidden = true; workbenchView.inert = true;
app.append(shopView, workbenchView);
let workbench; let loading; let navigation = 0; let pendingCase = null;
const shop = mountShop(shopView, { openCase(value) { pendingCase = value; if (location.hash === '#/case') route(); else location.hash = '/case'; } });
async function route() {
  const request = ++navigation;
  const hash = location.hash;
  const inspect = hash === '#/inspect' || hash === '#/case' || ['#workspace', '#custom-payload', '#case-panel'].includes(hash);
  shopView.hidden = inspect; shopView.inert = inspect; shop.setActive(!inspect);
  workbenchView.hidden = !inspect; workbenchView.inert = !inspect;
  document.body.classList.toggle('shop-active', !inspect); document.body.classList.toggle('inspect-active', inspect);
  document.querySelector('.skip-link').href = inspect ? '#workspace' : '#shop-workspace';
  document.querySelector('.skip-link').textContent = inspect ? 'Skip to inspection workspace' : 'Skip to shopping task';
  document.title = inspect ? 'ShadowPrompt | Advanced inspection' : 'Shelfday | ShadowPrompt';
  if (!inspect) { workbench?.setActive(false); return; }
  if (!loading) {
    workbenchView.textContent = 'Loading advanced inspection...';
    loading = import('./workbench.js').then(module => { workbench = module.mountWorkbench(workbenchView); return workbench; }).catch(error => { loading = null; workbenchView.textContent = `Advanced inspection could not load: ${error.message}`; throw error; });
  }
  try { await loading; } catch { return; }
  // Always suspend a late mount if navigation has already left it.
  if (request !== navigation) { workbench.setActive(!workbenchView.hidden); return; }
  workbench.setActive(true);
  if (hash === '#/case' || hash === '#case-panel') {
    if (pendingCase) { workbench.offerCase(pendingCase); pendingCase = null; }
    workbench.openCase();
  } else if (hash === '#custom-payload') document.querySelector('#custom-payload').focus();
}
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', event => { if (!event.persisted) shop.dispose(); });
route();
