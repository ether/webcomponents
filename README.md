# etherpad-webcomponents

Reusable [Lit](https://lit.dev) web components for the [Etherpad](https://etherpad.org) project — framework-agnostic custom elements that ship Etherpad's UI building blocks (buttons, inputs, dropdowns, modals, toasts, a color wheel, …) plus a **standalone rich-text editor** (`<ep-editor>`) powered by Etherpad's Ace editor engine and changeset model.

Because they are standard custom elements, the components work in any page or framework (React, Vue, Angular, Svelte, or plain HTML) without a wrapper.

- **Built with:** Lit 3 + TypeScript
- **Documented & tested with:** Storybook 10 + Vitest browser mode (Playwright/Chromium)
- **License:** MIT © The Etherpad Foundation

---

## Install

```bash
pnpm add etherpad-webcomponents
# or: npm install etherpad-webcomponents
```

## Usage

Import the whole library, or just the components you need (each is individually exported for tree-shaking):

```js
// everything
import 'etherpad-webcomponents';

// or a single component
import 'etherpad-webcomponents/EpButton.js';
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
import { EpButton, EpTheme, themes } from 'etherpad-webcomponents';
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
| `<ep-theme>` | `EpTheme` | `name` — applies a token set to its subtree | — |
| `<ep-editor>` | `EpEditor` | `content`, `readonly`, `wrap`, `author-id` | `ready`, `content-changed`, `selection-changed` |

### Theming

Components read CSS custom properties (`--text-color`, `--primary-color`, `--bg-soft-color`, …). Wrap a subtree in `<ep-theme name="…">` to apply a token set. Built-in themes: **`colibris`** (default, matches Etherpad's skin), **`colibris-dark`**, **`high-contrast`**, and **`warm`**. Register your own at runtime:

```js
import { EpTheme } from 'etherpad-webcomponents';
EpTheme.registerTheme('brand', { '--primary-color': '#ff5722', /* …all ThemeTokens */ });
```

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
import { AceEditor, AttributePool, makeChangesetTracker } from 'etherpad-webcomponents';
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
