import { chromium } from 'playwright';

const PORT = process.env.PORT || 5173;
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(`http://localhost:${PORT}/examples/`, { waitUntil: 'networkidle' });
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

// theme switch — assert the RENDERED page + editor backgrounds actually change,
// not just that a CSS var was set (the bug that motivated this test).
const pageBg = () => page.evaluate(() => getComputedStyle(document.querySelector('.page')).backgroundColor);
const editorBg = () => page.evaluate(() => {
  const c = document.querySelector('ep-editor')?.shadowRoot?.querySelector('.ep-editor-container');
  return c ? getComputedStyle(c).backgroundColor : null;
});
const lightPage = await pageBg(), lightEditor = await editorBg();
await page.selectOption('#theme-select', 'colibris-dark');
await page.waitForTimeout(300);
await check('theme switch changes page background', async () => (await pageBg()) !== lightPage);
await check('theme switch changes editor background', async () => (await editorBg()) !== lightEditor);

await page.screenshot({ path: 'examples/demo.png', fullPage: true });
console.log('\nscreenshot → examples/demo.png');
console.log(errors.length ? '\nCONSOLE ERRORS:\n' + errors.join('\n') : '\nno console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
