import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { AceEditor } from './editor/AceEditor.js';
import type AttributePool from './editor/AttributePool.js';

/**
 * `<ep-editor>` — A standalone rich-text editor web component based on
 * Etherpad's Ace editor engine.
 *
 * Supports bold, italic, underline, strikethrough, ordered/unordered lists,
 * indentation, undo/redo, and changeset-based collaboration.
 *
 * @fires content-changed - When the document text changes. Detail: `{ text: string }`
 * @fires selection-changed - When the selection changes. Detail: `{ selStart, selEnd }`
 * @fires ready - When the editor has finished initializing.
 */
@customElement('ep-editor')
export class EpEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      min-height: 100px;
    }

    .ep-editor-container {
      width: 100%;
      height: 100%;
      min-height: inherit;
      overflow: auto;
      font-family: var(--ep-editor-font, monospace);
      font-size: var(--ep-editor-font-size, 14px);
      line-height: var(--ep-editor-line-height, 1.6);
      color: var(--ep-editor-color, #333);
      background: var(--ep-editor-bg, #fff);
      padding: var(--ep-editor-padding, 8px 12px);
      box-sizing: border-box;
      outline: none;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .ep-editor-container:focus {
      outline: none;
    }

    .ep-editor-container .list-bullet1 { list-style-type: disc; }
    .ep-editor-container .list-bullet2 { list-style-type: circle; }
    .ep-editor-container .list-bullet3 { list-style-type: square; }
    .ep-editor-container .list-bullet4 { list-style-type: disc; }
    .ep-editor-container .list-number1 { list-style-type: decimal; }
    .ep-editor-container .list-number2 { list-style-type: lower-alpha; }
    .ep-editor-container .list-number3 { list-style-type: lower-roman; }
    .ep-editor-container .list-number4 { list-style-type: decimal; }

    .ep-editor-container ul, .ep-editor-container ol {
      padding-left: 1.5em;
      margin: 0;
    }

    .ep-editor-container .tag\\:b, .ep-editor-container b { font-weight: bold; }
    .ep-editor-container .tag\\:i, .ep-editor-container i { font-style: italic; }
    .ep-editor-container .tag\\:u, .ep-editor-container u { text-decoration: underline; }
    .ep-editor-container .tag\\:s, .ep-editor-container s { text-decoration: line-through; }

    .ep-editor-container a { color: var(--ep-editor-link-color, #0366d6); text-decoration: underline; }

    :host([readonly]) .ep-editor-container {
      opacity: 0.85;
      cursor: default;
    }
  `;

  /** Initial text content for the editor. */
  @property({ type: String }) content = '';

  /** Whether the editor is read-only. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Whether text wrapping is enabled. */
  @property({ type: Boolean }) wrap = true;

  /** The current author ID for attributing changes. */
  @property({ type: String, attribute: 'author-id' }) authorId = '';

  @state() private _ready = false;

  private _editor: AceEditor | null = null;
  private _initialContentSet = false;

  get editor(): AceEditor | null {
    return this._editor;
  }

  // ── Lifecycle ──────────────────────────────────────────────

  protected firstUpdated() {
    const container = this.shadowRoot!.querySelector('.ep-editor-container') as HTMLElement;
    if (!container) return;

    this._editor = new AceEditor(container);
    this._editor.init().then(() => {
      this._ready = true;

      if (this.content && !this._initialContentSet) {
        this._editor!.setText(this.content);
        this._initialContentSet = true;
      }

      this._editor!.setEditable(!this.readonly);
      this._editor!.setWraps(this.wrap);

      if (this.authorId) {
        this._editor!.setAuthor(this.authorId);
      }

      // Wire up events from the engine
      this._editor!.onContentChanged = (text: string) => {
        this.dispatchEvent(new CustomEvent('content-changed', {
          detail: { text },
          bubbles: true,
          composed: true,
        }));
      };

      this._editor!.onSelectionChanged = (selStart: number[], selEnd: number[]) => {
        this.dispatchEvent(new CustomEvent('selection-changed', {
          detail: { selStart, selEnd },
          bubbles: true,
          composed: true,
        }));
      };

      this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
    });
  }

  protected updated(changedProperties: Map<string, unknown>) {
    if (!this._editor || !this._ready) return;

    if (changedProperties.has('readonly')) {
      this._editor.setEditable(!this.readonly);
    }

    if (changedProperties.has('wrap')) {
      this._editor.setWraps(this.wrap);
    }

    if (changedProperties.has('authorId') && this.authorId) {
      this._editor.setAuthor(this.authorId);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._editor) {
      this._editor.dispose();
      this._editor = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /** Returns the current document text. */
  getText(): string {
    return this._editor?.getText() ?? '';
  }

  /** Sets the document text, replacing all current content. */
  setText(text: string) {
    if (this._editor && this._ready) {
      this._editor.setText(text);
    } else {
      this.content = text;
    }
  }

  /** Returns the attributed text with the attribute pool. */
  getAttributedText(): { text: string; attribs: string; pool: AttributePool } | null {
    return this._editor?.getAttributedText() ?? null;
  }

  /** Sets the attributed text (for advanced/collaborative use). */
  setAttributedText(atext: { text: string; attribs: string }, apoolJsonObj?: unknown) {
    this._editor?.setAttributedText(atext, apoolJsonObj);
  }

  /** Toggles a formatting attribute on the current selection (e.g. 'bold', 'italic'). */
  toggleFormat(name: string) {
    this._editor?.toggleAttribute(name);
  }

  /** Sets a formatting attribute on the current selection. */
  setFormattingAttribute(name: string, value: string) {
    this._editor?.setAttribute(name, value);
  }

  /** Returns whether the given attribute is active on the current selection. */
  getFormattingAttribute(name: string): boolean {
    return this._editor?.getAttribute(name) ?? false;
  }

  /** Inserts an unordered (bullet) list at the current line. */
  insertUnorderedList() {
    this._editor?.insertUnorderedList();
  }

  /** Inserts an ordered (numbered) list at the current line. */
  insertOrderedList() {
    this._editor?.insertOrderedList();
  }

  /** Indents or outdents the current selection. */
  indentOutdent(isOut: boolean) {
    this._editor?.indentOutdent(isOut);
  }

  /** Performs undo. */
  undo() {
    this._editor?.undo();
  }

  /** Performs redo. */
  redo() {
    this._editor?.redo();
  }

  /** Focuses the editor. */
  focusEditor() {
    this._editor?.focus();
  }

  /**
   * Applies an external changeset (for collaboration).
   * @param cs - The encoded changeset string.
   * @param optAuthor - Optional author ID.
   * @param apoolJsonObj - Optional attribute pool JSON.
   */
  applyChangeset(cs: string, optAuthor?: string, apoolJsonObj?: unknown) {
    this._editor?.applyChangeset(cs, optAuthor, apoolJsonObj);
  }

  /**
   * Prepares the user's pending changes as a changeset (for collaboration).
   * Returns `{ changeset, apool }` or null if no changes.
   */
  prepareUserChangeset(): { changeset: string | null; apool: unknown } | null {
    return this._editor?.prepareUserChangeset() ?? null;
  }

  /** Sets an author's display color. */
  setAuthorInfo(author: string, info: { bgcolor?: string }) {
    this._editor?.setAuthorInfo(author, info);
  }

  // ── Collaboration API ─────────────────────────────────────

  /** Sets the base text for collaboration tracking. */
  setBaseText(txt: string): void {
    this._editor?.setBaseText(txt);
  }

  /** Sets the base attributed text from the server. */
  setBaseAttributedText(atxt: { text: string; attribs: string }, apoolJsonObj?: unknown): void {
    this._editor?.setBaseAttributedText(atxt, apoolJsonObj);
  }

  /** Applies remote changes to the base text. */
  applyChangesToBase(c: string, optAuthor?: string, apoolJsonObj?: unknown): void {
    this._editor?.applyChangesToBase(c, optAuthor, apoolJsonObj);
  }

  /** Commits prepared changeset to the base after server confirmation. */
  applyPreparedChangesetToBase(): void {
    this._editor?.applyPreparedChangesetToBase();
  }

  /** Registers a callback for when the user makes changes. */
  setUserChangeNotificationCallback(f: () => void): void {
    this._editor?.setUserChangeNotificationCallback(f);
  }

  /** Sets an editor property (wraps, showsauthorcolors, etc.). */
  setProperty(key: string, value: unknown): void {
    this._editor?.setProperty(key, value);
  }

  /** Returns the international composition state. */
  getInInternationalComposition(): unknown {
    return this._editor?.getInInternationalComposition() ?? null;
  }

  // ── Render ─────────────────────────────────────────────────

  protected render() {
    return html`
      <div
        class="ep-editor-container"
        contenteditable="${this.readonly ? 'false' : 'true'}"
        role="textbox"
        aria-multiline="true"
        aria-readonly="${this.readonly}"
        spellcheck="true"
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ep-editor': EpEditor;
  }
}
