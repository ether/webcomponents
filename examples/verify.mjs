import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:5199/examples/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const check = async (label, fn) => {
  try { const v = await fn(); console.log(`${v ? '✓' : '✗'} ${label}${v && v !== true ? ' → ' + v : ''}`); return !!v; }
  catch (e) { console.log(`✗ ${label} → ${e.message}`); return false; }
};

// every custom element upgraded (has a shadowRoot or is defined)
const tags = ['ep-theme','ep-button','ep-input','ep-checkbox','ep-card','ep-dropdown',
  'ep-toolbar-select','ep-color-picker','ep-color-wheel','ep-user-badge','ep-chat-message',
  'ep-modal','ep-toast-container','ep-editor'];
for (const t of tags) {
  await check(`<${t}> upgraded`, () => page.evaluate((tag) => {
    const el = document.querySelector(tag);
    return !!(el && (el.shadowRoot || customElements.get(tag)));
  }, t));
}

// button renders a real <button> in its shadow root
await check('ep-button renders shadow <button>', () =>
  page.evaluate(() => !!document.querySelector('ep-button')?.shadowRoot?.querySelector('button')));

// editor becomes ready and exposes its engine
await page.waitForTimeout(500);
await check('ep-editor has text content', () =>
  page.evaluate(() => document.querySelector('ep-editor')?.getText()?.length > 0));

// open the modal
await page.click('#open-modal');
await check('modal opens (open attr)', () =>
  page.evaluate(() => document.querySelector('ep-modal')?.hasAttribute('open')));
await page.evaluate(() => document.querySelector('ep-modal').open = false);

// fire a toast
await page.click('#show-toast');
await check('toast item appears', () =>
  page.evaluate(() => document.querySelector('ep-toast-container')?.querySelectorAll('ep-toast-item').length > 0));

// fire a notification
await page.click('#show-notif');
await check('notification appears', () =>
  page.evaluate(() => document.querySelectorAll('ep-notification').length > 0));

// theme switch
await page.selectOption('#theme-select', 'colibris-dark');
await check('theme switch applies token', () =>
  page.evaluate(() => document.getElementById('root-theme').style.getPropertyValue('--bg-color').trim() === '#2c3143'));

await page.screenshot({ path: 'examples/demo.png', fullPage: true });
console.log('\nscreenshot → examples/demo.png');
console.log(errors.length ? '\nCONSOLE ERRORS:\n' + errors.join('\n') : '\nno console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
