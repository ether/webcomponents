# etherpad-webcomponents

Reusable [Lit](https://lit.dev) web components for the [Etherpad](https://etherpad.org) project — framework-agnostic custom elements that ship Etherpad's UI building blocks (buttons, inputs, dropdowns, modals, toasts, a color wheel, …) plus a **standalone rich-text editor** (`<ep-editor>`) powered by Etherpad's Ace editor engine and changeset model.

Because they are standard custom elements, the components work in any page or framework (React, Vue, Angular, Svelte, or plain HTML) without a wrapper.

- **Built with:** Lit 3 + TypeScript
- **Documented & tested with:** Storybook 10 + Vitest browser mode (Playwright/Chromium)
- **License:** MIT © The Etherpad Foundation

---

## Install

```bash
pnpm add @samtv12345/etherpad-webcomponents
# or: npm install @samtv12345/etherpad-webcomponents
```

## Usage

Import the whole library, or just the components you need (each is individually exported for tree-shaking):

```js
// everything
import '@samtv12345/etherpad-webcomponents';

// or a single component
import '@samtv12345/etherpad-webcomponents/EpButton.js';
```

```html
<ep-theme name="colibris">
  <ep-button variant="primary">Save changes</ep-button>

  <ep-input label="Pad name" placeholder="My pad"></ep-input>

  <ep-editor content="Hello, collaborative world!"></ep-editor>
</ep-theme>
```

The named exports (classes) are also available for programmatic use:

```js
import { EpButton, EpTheme, themes } from '@samtv12345/etherpad-webcomponents';
```

---

## Components

| Tag | Class | Key attributes | Custom event |
| --- | --- | --- | --- |
| `<ep-button>` | `EpButton` | `variant` (`default`/`primary`/`ghost`/`icon`), `size`, `uppercase`, `disabled`, `type` | — |
| `<ep-card>` | `EpCard` | `card-title`, `subtitle`, `bordered`, `compact` | — |
| `<ep-chat-message>` | `EpChatMessage` | `author`, `author-color`, `time`, `own` | — |
| `<ep-checkbox>` | `EpCheckbox` | `checked`, `variant`, `disabled`, `label` | `ep-change` |
| `<ep-color-picker>` | `EpColorPicker` | `colors[]`, `value` | `ep-color-select` |
| `<ep-color-wheel>` | `EpColorWheel` | `value` (canvas HSL hue/sat/lum wheel) | `ep-color-change` |
| `<ep-dropdown>` / `<ep-dropdown-item>` | `EpDropdown` / `EpDropdownItem` | `trigger` (`click`/`hover`), `align`, `open` | `ep-dropdown-select` |
| `<ep-input>` | `EpInput` | `label`, `value`, `placeholder`, `hint`, `error-text`, `error`, `type` (incl. `textarea`) | `ep-input` |
| `<ep-modal>` | `EpModal` | dialog with backdrop & slots | `ep-modal-close` |
| `<ep-notification>` | `EpNotification` | `type`, `position`, `duration` | — |
| `<ep-toast-container>` / `<ep-toast-item>` | `EpToastContainer` / `EpToastItem` | `position`, `type`, `message`, `duration` | — |
| `<ep-toolbar-select>` | `EpToolbarSelect` | `options[]`, `value`, `icon-class`, `label`, `placeholder` | `ep-toolbar-select:change` |
| `<ep-user-badge>` | `EpUserBadge` | `name`, `color`, `size`, `online` | — |
| `<ep-avatar>` | `EpAvatar` | `name`, `color`, `src`, `size`, `status` (`online`/`idle`/`offline`) | — |
| `<ep-toolbar>` / `<ep-toolbar-button>` / `<ep-toolbar-separator>` | `EpToolbar` / `EpToolbarButton` / `EpToolbarSeparator` | toolbar: `label`, `breakpoint`, `more-label`, slot `end`; button: `key`, `label`, `toggle`, `pressed`, `active`, `expanded`, `badge`, `priority="low"` | `ep-toolbar-action` |
| `<ep-user-list>` | `EpUserList` | `.users` (`{ id, name, color, self, status }`), `heading`, `selectable`, `readonly` | `ep-user-rename`, `ep-user-color-request`, `ep-user-select` |
| `<ep-chat-panel>` | `EpChatPanel` | `.messages` or slotted `<ep-chat-message slot="messages">`, `show-close`, `show-sticky`, `sticky`, `has-more`, `loading`, `readonly`, `floating` | `ep-chat-send`, `ep-chat-close`, `ep-chat-sticky`, `ep-chat-load-more` |
| `<ep-popup>` | `EpPopup` | `open`, `heading`, `anchor`, `align`, `persistent`, slot `footer`; `show()`/`hide()`/`toggle()` | `ep-popup-open`, `ep-popup-close` |
| `<ep-settings-section>` / `<ep-settings-row>` | `EpSettingsSection` / `EpSettingsRow` | section: `heading`, `description`; row: `label`, `description`, `stacked`, `divided`, `disabled` | — |
| `<ep-segmented>` | `EpSegmented` | `.options` (`{ value, label, icon?, disabled? }`), `value`, `label` | `ep-change` |
| `<ep-tabs>` / `<ep-tab>` | `EpTabs` / `EpTab` | `value`, `variant` (`underline`/`pills`); tab: `value`, `label`, `disabled` | `ep-tab-change` |
| `<ep-theme>` | `EpTheme` | `name` (incl. `auto`), `light`, `dark`, `.tokens` — applies a token set to its subtree | `ep-theme-change` |
| `<ep-editor>` | `EpEditor` | `content`, `readonly`, `wrap`, `author-id` | `ready`, `content-changed`, `selection-changed` |

### Theming

Components only read CSS custom properties, so every colour, radius and shadow can be changed without touching the components. Built-in themes: **`colibris`** (default, Etherpad's light-green skin), **`colibris-dark`**, **`high-contrast`** and **`warm`**.

| Token | Used for |
| --- | --- |
| `--bg-color`, `--bg-soft-color`, `--light-color`, `--super-light-color` | surfaces |
| `--text-color`, `--text-soft-color`, `--dark-color`, `--super-dark-color` | text, icons |
| `--middle-color` | borders |
| `--primary-color`, `--primary-text-color` | accent and text on the accent |
| `--danger-color`, `--success-color`, `--warning-color` | states |
| `--focus-color` | focus ring |
| `--radius`, `--radius-large`, `--shadow` | shape and elevation |
| `--main-font-family` | font |

A theme only needs to state what differs from its base:

```js
import { defineTheme } from '@samtv12345/etherpad-webcomponents';

defineTheme('acme', { '--primary-color': '#7c3aed' });                  // based on colibris
defineTheme('acme-dark', { '--primary-color': '#a78bfa' }, 'colibris-dark');
```

```html
<!-- fixed theme -->
<ep-theme name="acme">…</ep-theme>

<!-- follow the operating system -->
<ep-theme name="auto" light="acme" dark="acme-dark">…</ep-theme>
```

`<ep-theme>` sets `data-scheme="light|dark"` on itself, fires `ep-theme-change` and updates live when a theme is redefined. Single tokens can be overridden per element with the `tokens` property. Without the element:

- `applyTheme(document.documentElement, 'acme')` sets the tokens on any element (and removes tokens of the previous call that the new set lacks),
- `themeToCss('acme', ':root')` returns the tokens as a CSS rule, e.g. for rendering them server-side.

`@samtv12345/etherpad-webcomponents/themes.js` contains only these functions and the token sets, without any custom element.

### Pad building blocks

The pad, timeslider and sheet pages are put together from `ep-toolbar`, `ep-popup` + `ep-settings-*`, `ep-user-list` and `ep-chat-panel`; the story **Pad/Layout** shows them together. All of them only emit events – the app decides what a toolbar action, a sent chat message or a rename does. Every visible text is an attribute, so pages can pass in their translations. Toolbar colours can be set separately via `--toolbar-bg-color`, `--toolbar-text-color`, `--toolbar-border-color`, `--toolbar-hover-color`, `--toolbar-active-color` and `--toolbar-active-text-color`.

### The editor (`<ep-editor>`)

`<ep-editor>` embeds Etherpad's Ace editor engine (under `src/editor/`: `Changeset`, `AttributePool`, `changesettracker`, content collector, op assemblers, etc.) as a self-contained element. It supports bold/italic/underline/strikethrough, ordered & unordered lists, indentation, undo/redo, and changeset-based collaboration.

Selected methods on the element (see `src/EpEditor.ts` for the full API):

```js
const ed = document.querySelector('ep-editor');
ed.getText();                        // current document text
ed.setText('...');                   // replace contents
ed.toggleFormat('bold');             // toggle a formatting attribute on the selection
ed.insertUnorderedList();            // list / indent helpers
ed.undo(); ed.redo();

// collaboration
ed.setBaseAttributedText(atext, pool);
ed.applyChangeset(cs, author, pool);
const pending = ed.prepareUserChangeset();   // { changeset, apool } to send to a server
```

The lower-level engine pieces are also exported for advanced use:

```js
import { AceEditor, AttributePool, makeChangesetTracker } from '@samtv12345/etherpad-webcomponents';
```

---

## Development

Requires Node.js and [pnpm](https://pnpm.io).

```bash
pnpm install                       # install dependencies
pnpm exec playwright install chromium   # one-time: browser for the test runner

pnpm storybook                     # interactive component explorer at http://localhost:6006
pnpm dev                           # vite dev server
pnpm typecheck                     # tsc --noEmit
pnpm build                         # emit dist/ (.js + .d.ts) via tsc
pnpm test                          # run the Storybook test suite (see below)
```

### Testing

Each component has a Storybook story file under `stories/`. The stories double as the test suite: their Storybook **`play` functions** assert behavior (rendering, attribute reflection, click handling, disabled state, event dispatch, …), and `pnpm test` runs every story's play function in a real **Chromium** browser via Vitest browser mode (`@storybook/addon-vitest` + `@vitest/browser-playwright`, configured in `vitest.config.ts`).

```bash
pnpm test --run
```

To add coverage, add a story with a `play` function — it will automatically be picked up as a test.

## Project layout

```
src/
  Ep*.ts            # the Lit components (one per custom element)
  index.ts          # public entry point — re-exports every component
  editor/           # Etherpad Ace editor engine + changeset model (backs <ep-editor>)
stories/            # Storybook stories (also the test suite, via play functions)
.storybook/         # Storybook config
vitest.config.ts    # browser-mode test runner config
```
