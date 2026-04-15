/**
 * AceEditor - Standalone editor engine adapted from Etherpad's ace2_inner.ts
 *
 * This is the core editing engine that works without iframes or collaboration
 * dependencies. It uses a simple container element (a <div contenteditable="true">)
 * inside Shadow DOM.
 *
 * Copyright 2009 Google Inc.
 * Copyright 2020 John McLear - The Etherpad Foundation.
 * Copyright 2025 - Adapted for standalone use.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Builder} from "./Builder.js";
import AttributeMap from './AttributeMap.js';
import {browserFlags as browser} from './browser_flags.js';
import * as Ace2Common from './ace2_common.js';
import {
  characterRangeFollow,
  checkRep,
  cloneAText,
  compose,
  deserializeOps,
  filterAttribNumbers,
  inverse,
  isIdentity,
  makeAText,
  makeAttribution,
  mapAttribNumbers,
  moveOpsToNewPool,
  mutateAttributionLines,
  mutateTextLines,
  oldLen,
  opsFromAText,
  pack,
  splitAttributionLines,
} from './Changeset.js';
import {colorutils} from './colorutils.js';
import {makeContentCollector} from './contentcollector.js';
import {domline} from './domline.js';
import {linestylefilter} from './linestylefilter.js';
import {undoModule} from './undomodule.js';
import AttributeManager from './AttributeManager.js';
import {editorBus} from './core/EventBus.js';
import SkipList from "./skiplist.js";
import AttribPool from './AttributePool.js';
import {SmartOpAssembler} from "./SmartOpAssembler.js";
import Op from "./Op.js";
import {buildKeepRange, buildKeepToStartOfRange, buildRemoveRange} from './ChangesetUtils.js';
import {makeCSSManager} from './cssmanager.js';
import {makeChangesetTracker} from './changesettracker.js';

const isNodeText = Ace2Common.isNodeText;
const getAssoc = Ace2Common.getAssoc;
const setAssoc = Ace2Common.setAssoc;

export class AceEditor {
  // -----------------------------------------------------------------------
  // Public properties
  // -----------------------------------------------------------------------

  /**
   * Document representation. The core data model.
   */
  readonly rep: {
    lines: SkipList;
    selStart: any;
    selEnd: any;
    selFocusAtStart: boolean;
    alltext: string;
    alines: string[];
    apool: AttribPool;
  };

  // -----------------------------------------------------------------------
  // Private properties
  // -----------------------------------------------------------------------

  private targetBody: HTMLElement;
  private targetDoc: Document;
  private rootNode: Document | ShadowRoot;
  private cssManager: any;
  private documentAttributeManager: any;
  private disposed: boolean;
  private isEditable: boolean;
  private doesWrap: boolean;
  private isStyled: boolean;
  private thisAuthor: string;

  /** Callback invoked when the document text changes. */
  onContentChanged: ((text: string) => void) | null = null;
  /** Callback invoked when the selection changes. */
  onSelectionChanged: ((selStart: any, selEnd: any) => void) | null = null;

  private currentCallStack: any;
  private observedChanges: any;
  private _nextId: number;
  private idleWorkTimer: any;
  private inInternationalComposition: any;
  private thisKeyDoesntTriggerNormalize: boolean;
  private authorInfos: Record<string, any>;
  private changesetTracker: ReturnType<typeof makeChangesetTracker> | null = null;
  private onKeyPressHandler: ((evt: Event) => void) | null = null;
  private onKeyDownHandler: ((evt: Event) => void) | null = null;
  private notifyDirtyHandler: (() => void) | null = null;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  private static readonly THE_TAB = '    '; // 4 spaces
  private static readonly MAX_LIST_LEVEL = 16;
  private static readonly STYLE_ATTRIBS: Record<string, boolean> = {
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    list: true,
  };

  private static readonly _blockElems: Record<string, number> = {
    div: 1,
    p: 1,
    pre: 1,
    li: 1,
    ol: 1,
    ul: 1,
  };

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(container: HTMLElement) {
    this.targetBody = container;
    this.targetDoc = container.ownerDocument;
    const rn = container.getRootNode();
    this.rootNode = (rn instanceof ShadowRoot) ? rn : this.targetDoc;
    this.disposed = false;
    this.isEditable = true;
    this.doesWrap = true;
    this.isStyled = true;
    this.thisAuthor = '';
    this.currentCallStack = null;
    this._nextId = 1;
    this.inInternationalComposition = null;
    this.thisKeyDoesntTriggerNormalize = false;
    this.authorInfos = {};

    this.rep = {
      lines: new SkipList(),
      selStart: null,
      selEnd: null,
      selFocusAtStart: false,
      alltext: '',
      alines: [],
      apool: new AttribPool(),
    };

    if (undoModule.enabled) {
      (undoModule as any).apool = this.rep.apool;
    }

    this.clearObservedChanges();

    // Set up CSS manager
    this.cssManager = this.createCSSManager();

    // Init documentAttributeManager
    this.documentAttributeManager = new AttributeManager(
      this.rep as any,
      (cs: string) => this.performDocumentApplyChangeset(cs),
    );

    // Create idle work timer
    this.idleWorkTimer = this.makeIdleAction(() => {
      if (this.inInternationalComposition) {
        this.idleWorkTimer.atLeast(500);
        return;
      }

      this.inCallStackIfNecessary('idleWorkTimer', () => {
        const isTimeUp = this.newTimeLimit(250);
        let finishedImportantWork = false;
        let finishedWork = false;

        try {
          this.incorporateUserChanges();
          if (isTimeUp()) return;
          finishedImportantWork = true;
          finishedWork = true;
        } finally {
          if (finishedWork) {
            this.idleWorkTimer.atMost(1000);
          } else if (finishedImportantWork) {
            this.idleWorkTimer.atMost(500);
          } else {
            let timeToWait = Math.round(isTimeUp.elapsed() / 2);
            if (timeToWait < 100) timeToWait = 100;
            this.idleWorkTimer.atMost(timeToWait);
          }
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async init(): Promise<void> {
    this.inCallStack('setup', () => {
      if (browser.firefox) this.targetBody.classList.add('mozilla');
      if (browser.safari) this.targetBody.classList.add('safari');
      this.targetBody.classList.toggle('authorColors', true);
      this.targetBody.classList.toggle('doesWrap', this.doesWrap);

      this.enforceEditability();

      // Set up dom and rep
      while (this.targetBody.firstChild) {
        this.targetBody.removeChild(this.targetBody.firstChild);
      }
      const oneEntry = this.createDomLineEntry('');
      this.doRepLineSplice(0, this.rep.lines.length(), [oneEntry]);
      this.insertDomLines(null, [oneEntry.domInfo]);
      this.rep.alines = splitAttributionLines(
        makeAttribution('\n'), '\n');

      this.bindTheEventHandlers();
    });

    // Initialize changeset tracker for collaboration support
    this.changesetTracker = makeChangesetTracker(
      window,
      this.rep.apool,
      {
        withCallbacks: (operationName: string, f: (callbacks: any) => void) => {
          this.inCallStackIfNecessary(operationName, () => {
            this.fastIncorp(1);
            f({
              setDocumentAttributedText: (atext: any) => {
                this.setDocAText(atext);
              },
              applyChangesetToDocument: (changeset: string, preferInsertionAfterCaret: boolean) => {
                const oldEventType = this.currentCallStack.editEvent.eventType;
                this.currentCallStack.startNewEvent('nonundoable');
                this.performDocumentApplyChangeset(changeset, preferInsertionAfterCaret);
                this.currentCallStack.startNewEvent(oldEventType);
              },
            });
          });
        },
      },
      () => this.thisAuthor,
    );

    // Note: editor:ace:initialized is NOT emitted here.
    // When used within etherpad, ace.ts emits this event with the shared info object
    // that holds ace_* prefixed methods for plugin compatibility.
  }

  dispose(): void {
    this.disposed = true;
    if (this.idleWorkTimer) this.idleWorkTimer.never();
  }

  // -----------------------------------------------------------------------
  // Public API - Text
  // -----------------------------------------------------------------------

  getText(): string {
    const alltext = this.rep.alltext;
    let len = alltext.length;
    if (len > 0) len--; // final extra newline
    return alltext.substring(0, len);
  }

  setText(text: string): void {
    this.importText(text, false, false);
  }

  getAttributedText(): { text: string; attribs: string; pool: AttribPool } {
    return {
      text: this.rep.alltext,
      attribs: this.rep.alines.join(''),
      pool: this.rep.apool,
    };
  }

  setAttributedText(atext: any, apoolJsonObj?: any): void {
    this.importAText(atext, apoolJsonObj, false);
  }

  // -----------------------------------------------------------------------
  // Public API - Focus / Editable
  // -----------------------------------------------------------------------

  focus(): void {
    this.targetBody.focus();
  }

  setEditable(val: boolean): void {
    this.isEditable = val;
    this.targetBody.contentEditable = this.isEditable ? 'true' : 'false';
    this.targetBody.classList.toggle('static', !this.isEditable);
  }

  // -----------------------------------------------------------------------
  // Public API - Formatting
  // -----------------------------------------------------------------------

  toggleAttribute(name: string): void {
    this.inCallStackIfNecessary('toggleAttribute', () => {
      this.fastIncorp(13);
      this.toggleAttributeOnSelection(name);
    });
  }

  setAttribute(name: string, value: string): void {
    this.inCallStackIfNecessary('setAttribute', () => {
      this.fastIncorp(13);
      this.setAttributeOnSelection(name, value);
    });
  }

  getAttribute(name: string): boolean {
    if (!(this.rep.selStart && this.rep.selEnd)) return false;
    return !!this.getAttributeOnSelection(name);
  }

  // -----------------------------------------------------------------------
  // Public API - Lists
  // -----------------------------------------------------------------------

  setLineListType(lineNum: number, listType: string): void {
    this.inCallStackIfNecessary('setLineListType', () => {
      this.fastIncorp(9);
      this._setLineListType(lineNum, listType);
    });
  }

  indentOutdent(isOut: boolean): void {
    this.inCallStackIfNecessary('indentOutdent', () => {
      this.fastIncorp(9);
      this.doIndentOutdent(isOut);
    });
  }

  insertUnorderedList(): void {
    this.inCallStackIfNecessary('insertUnorderedList', () => {
      this.fastIncorp(9);
      this.doInsertUnorderedList();
    });
  }

  insertOrderedList(): void {
    this.inCallStackIfNecessary('insertOrderedList', () => {
      this.fastIncorp(9);
      this.doInsertOrderedList();
    });
  }

  // -----------------------------------------------------------------------
  // Public API - Undo / Redo
  // -----------------------------------------------------------------------

  undo(): void {
    this.inCallStackIfNecessary('undo', () => {
      this.fastIncorp(6);
      this.doUndoRedo('undo');
    });
  }

  redo(): void {
    this.inCallStackIfNecessary('redo', () => {
      this.fastIncorp(10);
      this.doUndoRedo('redo');
    });
  }

  // -----------------------------------------------------------------------
  // Public API - Changeset (for external collaboration)
  // -----------------------------------------------------------------------

  applyChangeset(cs: string, _optAuthor?: string, apoolJsonObj?: any): void {
    this.inCallStackIfNecessary('applyChangeset', () => {
      this.fastIncorp(1);
      if (apoolJsonObj) {
        const wireApool = (new AttribPool()).fromJsonable(apoolJsonObj);
        cs = moveOpsToNewPool(cs, wireApool, this.rep.apool);
      }
      const oldEventType = this.currentCallStack.editEvent.eventType;
      this.currentCallStack.startNewEvent('nonundoable');
      this.performDocumentApplyChangeset(cs);
      this.currentCallStack.startNewEvent(oldEventType);
    });
  }

  prepareUserChangeset(): { changeset: string | null; apool: any } | null {
    if (!this.rep || !this.rep.apool) return null;
    // Incorporate any pending user changes first
    if (this.currentCallStack) {
      this.fastIncorp(1);
    } else {
      this.inCallStackIfNecessary('prepareUserChangeset', () => {
        this.fastIncorp(1);
      });
    }
    if (this.changesetTracker) {
      return this.changesetTracker.prepareUserChangeset();
    }
    return {
      changeset: null,
      apool: this.rep.apool.toJsonable(),
    };
  }

  // -----------------------------------------------------------------------
  // Public API - Author
  // -----------------------------------------------------------------------

  setAuthor(authorId: string): void {
    this.thisAuthor = String(authorId);
    if (this.documentAttributeManager) {
      this.documentAttributeManager.author = this.thisAuthor;
    }
  }

  setAuthorInfo(author: string, info: { bgcolor?: string; fgColor?: string; fade?: number }): void {
    if (!author) return;
    if (typeof author !== 'string') {
      throw new Error(`setAuthorInfo: author (${author}) is not a string`);
    }
    if (!info) {
      delete this.authorInfos[author];
    } else {
      this.authorInfos[author] = info;
    }
    this.setAuthorStyle(author, info);
  }

  // -----------------------------------------------------------------------
  // Public API - Collaboration (changesetTracker delegation)
  // -----------------------------------------------------------------------

  setBaseText(txt: string): void {
    this.changesetTracker?.setBaseText(txt);
  }

  setBaseAttributedText(atxt: any, apoolJsonObj?: any): void {
    this.changesetTracker?.setBaseAttributedText(atxt, apoolJsonObj);
  }

  applyChangesToBase(c: string, optAuthor?: string, apoolJsonObj?: any): void {
    this.changesetTracker?.applyChangesToBase(c, optAuthor, apoolJsonObj);
  }

  applyPreparedChangesetToBase(): void {
    this.changesetTracker?.applyPreparedChangesetToBase();
  }

  setUserChangeNotificationCallback(f: () => void): void {
    this.changesetTracker?.setUserChangeNotificationCallback(f);
  }

  // -----------------------------------------------------------------------
  // Public API - Etherpad Compatibility
  // -----------------------------------------------------------------------

  setProperty(key: string, value: any): void {
    // The original ace2_inner editor lower-cases the key before dispatching,
    // so callers can pass either 'userAuthor' or 'userauthor', 'rtlIsTrue'
    // or 'rtlistrue'. Preserving that behavior here is critical: e.g.
    // collab_client.ts calls setProperty('userAuthor', userId) — if this
    // switch were case-sensitive it would silently ignore the call and
    // every character the user typed would be attributed to the empty
    // author string (no `author-*` class on rendered spans, no authorship
    // coloring, no clearauthorship).
    switch (key.toLowerCase()) {
      case 'wraps':
        this.setWraps(value);
        break;
      case 'showsauthorcolors':
        this.targetBody.classList.toggle('authorColors', !!value);
        break;
      case 'showsuserselections':
        this.targetBody.classList.toggle('userSelections', !!value);
        break;
      case 'userauthor':
        this.setAuthor(value);
        break;
      case 'styled':
        this.setStyled(value);
        break;
      case 'textface':
        this.targetBody.style.fontFamily = value || '';
        break;
      case 'rtlistrue':
        this.targetBody.dir = value ? 'rtl' : 'ltr';
        break;
      case 'showslinenumbers':
        // Line numbers are not managed by the editor itself
        break;
    }
  }

  exportText(): string {
    return this.getText();
  }

  getInInternationalComposition(): any {
    return this.inInternationalComposition;
  }

  setOnKeyPress(handler: ((evt: Event) => void) | null): void {
    this.onKeyPressHandler = handler;
  }

  setOnKeyDown(handler: ((evt: Event) => void) | null): void {
    this.onKeyDownHandler = handler;
  }

  setNotifyDirty(handler: (() => void) | null): void {
    this.notifyDirtyHandler = handler;
  }

  callWithAce(fn: (editor: AceEditor) => any, callStack?: string, normalize?: boolean): any {
    let wrapper = () => fn(this);
    if (normalize !== undefined) {
      const inner = wrapper;
      wrapper = () => {
        this.fastIncorp(9);
        return inner();
      };
    }
    if (callStack !== undefined) {
      return this.inCallStackIfNecessary(callStack, wrapper);
    }
    return wrapper();
  }

  // -----------------------------------------------------------------------
  // Public API - Selection info
  // -----------------------------------------------------------------------

  isCaret(): boolean {
    return !!(
      this.rep.selStart && this.rep.selEnd &&
      this.rep.selStart[0] === this.rep.selEnd[0] &&
      this.rep.selStart[1] === this.rep.selEnd[1]
    );
  }

  getCaretLine(): number {
    if (!this.rep.selStart) return -1;
    return this.rep.selStart[0];
  }

  getCaretColumn(): number {
    if (!this.rep.selStart) return -1;
    return this.rep.selStart[1];
  }

  // -----------------------------------------------------------------------
  // Public API - Misc
  // -----------------------------------------------------------------------

  replaceRange(start: [number, number], end: [number, number], text: string): void {
    this.inCallStackIfNecessary('replaceRange', () => {
      this.fastIncorp(9);
      this.performDocumentReplaceRange(start, end, text);
    });
  }

  execCommand(cmd: string, ...args: any[]): void {
    cmd = cmd.toLowerCase();
    const cmds: Record<string, (...args: any[]) => void> = {
      clearauthorship: (prompt?: Function) => {
        if (!(this.rep.selStart && this.rep.selEnd) || this.isCaret()) {
          if (prompt) {
            prompt();
          } else {
            this.performDocumentApplyAttributesToCharRange(0, this.rep.alltext.length, [
              ['author', ''],
            ]);
          }
        } else {
          this.setAttributeOnSelection('author', '');
        }
      },
    };
    if (cmds[cmd]) {
      this.inCallStackIfNecessary(cmd, () => {
        this.fastIncorp(9);
        cmds[cmd](...args);
      });
    }
  }

  setWraps(newVal: boolean): void {
    this.doesWrap = newVal;
    this.targetBody.classList.toggle('doesWrap', this.doesWrap);
    setTimeout(() => {
      this.inCallStackIfNecessary('setWraps', () => {
        this.fastIncorp(7);
        this.recreateDOM();
      });
    }, 0);
  }

  setStyled(newVal: boolean): void {
    const oldVal = this.isStyled;
    this.isStyled = !!newVal;
    if (newVal !== oldVal) {
      if (!newVal) {
        this.inCallStackIfNecessary('setStyled', () => {
          this.fastIncorp(12);
          const clearStyles = [];
          for (const k of Object.keys(AceEditor.STYLE_ATTRIBS)) {
            clearStyles.push([k, '']);
          }
          this.performDocumentApplyAttributesToCharRange(0, this.rep.alltext.length, clearStyles);
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private - CSS Manager
  // -----------------------------------------------------------------------

  private createCSSManager(): any {
    const styleElement = this.targetDoc.createElement('style');
    // If the container is inside a shadow root, append there; otherwise append to head
    const root = this.targetBody.getRootNode();
    if (root instanceof ShadowRoot) {
      root.appendChild(styleElement);
    } else if (this.targetBody.parentNode) {
      this.targetBody.parentNode.insertBefore(styleElement, this.targetBody);
    } else {
      this.targetDoc.head.appendChild(styleElement);
    }
    return makeCSSManager(styleElement.sheet!);
  }

  // -----------------------------------------------------------------------
  // Private - Author Styling
  // -----------------------------------------------------------------------

  private getAuthorClassName(author: string): string {
    return `author-${author.replace(/[^a-y0-9]/g, (c) => {
      if (c === '.') return '-';
      return `z${c.charCodeAt(0)}z`;
    })}`;
  }

  private className2Author(className: string): string | null {
    if (className.substring(0, 7) === 'author-') {
      return className.substring(7).replace(/[a-y0-9]+|-|z.+?z/g, (cc) => {
        if (cc === '-') return '.';
        if (cc.charAt(0) === 'z') return String.fromCharCode(Number(cc.slice(1, -1)));
        return cc;
      });
    }
    return null;
  }

  private getAuthorColorClassSelector(oneClassName: string): string {
    return `.authorColors .${oneClassName}`;
  }

  private fadeColor(colorCSS: string, fadeFrac: number): string {
    let color = colorutils.css2triple(colorCSS);
    color = colorutils.blend(color, [1, 1, 1], fadeFrac);
    return colorutils.triple2css(color);
  }

  private setAuthorStyle(author: string, info: any): void {
    const authorSelector = this.getAuthorColorClassSelector(
      this.getAuthorClassName(author));

    if (!info) {
      this.cssManager.removeSelectorStyle(authorSelector);
    } else if (info.bgcolor) {
      let bgcolor = info.bgcolor;
      if (typeof info.fade === 'number') {
        bgcolor = this.fadeColor(bgcolor, info.fade);
      }
      const textColor = colorutils.textColorFromBackgroundColor(bgcolor, 'default');
      const style = this.cssManager.selectorStyle(authorSelector);
      style.backgroundColor = bgcolor;
      style.color = textColor;
      style['padding-top'] = '3px';
      style['padding-bottom'] = '4px';
    }
  }

  // -----------------------------------------------------------------------
  // Private - Call Stack Management
  // -----------------------------------------------------------------------

  private inCallStack(type: string, action: Function): any {
    if (this.disposed) return;

    const newEditEvent = (eventType: string) => ({
      eventType,
      backset: null,
    });

    const submitOldEvent = (evt: any) => {
      if (this.rep.selStart && this.rep.selEnd) {
        const selStartChar = this.rep.lines.offsetOfIndex(this.rep.selStart[0]) +
          this.rep.selStart[1];
        const selEndChar = this.rep.lines.offsetOfIndex(this.rep.selEnd[0]) +
          this.rep.selEnd[1];
        evt.selStart = selStartChar;
        evt.selEnd = selEndChar;
        evt.selFocusAtStart = this.rep.selFocusAtStart;
      }
      if (undoModule.enabled) {
        let undoWorked = false;
        try {
          if (this.isPadLoading(evt.eventType)) {
            undoModule.clearHistory();
          } else if (evt.eventType === 'nonundoable') {
            if (evt.changeset) {
              undoModule.reportExternalChange(evt.changeset);
            }
          } else {
            undoModule.reportEvent(evt);
          }
          undoWorked = true;
        } finally {
          if (!undoWorked) {
            undoModule.enabled = false;
          }
        }
      }
    };

    const startNewEvent = (eventType: string, dontSubmitOld?: boolean) => {
      const oldEvent = this.currentCallStack.editEvent;
      if (!dontSubmitOld) {
        submitOldEvent(oldEvent);
      }
      this.currentCallStack.editEvent = newEditEvent(eventType);
      return oldEvent;
    };

    this.currentCallStack = {
      type,
      docTextChanged: false,
      selectionAffected: false,
      userChangedSelection: false,
      domClean: false,
      isUserChange: false,
      repChanged: false,
      editEvent: newEditEvent(type),
      startNewEvent,
    };

    let cleanExit = false;
    let result;
    try {
      result = action();

      editorBus.emit('editor:content:changed', {text: this.rep.alltext});
      if (this.onContentChanged) this.onContentChanged(this.rep.alltext);
      if (this.notifyDirtyHandler) this.notifyDirtyHandler();

      cleanExit = true;
    } finally {
      const cs = this.currentCallStack;
      if (cleanExit) {
        submitOldEvent(cs.editEvent);
        if (cs.domClean && cs.type !== 'setup') {
          if (cs.selectionAffected) {
            this.updateBrowserSelectionFromRep();
          }
          if (cs.docTextChanged && cs.type.indexOf('importText') < 0) {
            // Document changed notification
          }
        }
      } else if (this.currentCallStack.type === 'idleWorkTimer') {
        this.idleWorkTimer.atLeast(1000);
      }
      this.currentCallStack = null;
    }
    return result;
  }

  private inCallStackIfNecessary(type: string, action: Function): any {
    if (!this.currentCallStack) {
      return this.inCallStack(type, action);
    } else {
      return action();
    }
  }

  // -----------------------------------------------------------------------
  // Private - Timers
  // -----------------------------------------------------------------------

  private now(): number {
    return Date.now();
  }

  private newTimeLimit(ms: number): any {
    const startTime = this.now();
    let exceededAlready = false;
    const isTimeUp = () => {
      if (exceededAlready) return true;
      const elapsed = this.now() - startTime;
      if (elapsed > ms) {
        exceededAlready = true;
        return true;
      }
      return false;
    };
    isTimeUp.elapsed = () => this.now() - startTime;
    return isTimeUp;
  }

  private makeIdleAction(func: Function): any {
    let scheduledTimeout: any = null;
    let scheduledTime = 0;

    const unschedule = () => {
      if (scheduledTimeout) {
        clearTimeout(scheduledTimeout);
        scheduledTimeout = null;
      }
    };

    const reschedule = (time: number) => {
      unschedule();
      scheduledTime = time;
      let delay = time - this.now();
      if (delay < 0) delay = 0;
      scheduledTimeout = setTimeout(callback, delay);
    };

    const callback = () => {
      scheduledTimeout = null;
      func();
    };

    return {
      atMost: (ms: number) => {
        const latestTime = this.now() + ms;
        if (!scheduledTimeout || scheduledTime > latestTime) {
          reschedule(latestTime);
        }
      },
      atLeast: (ms: number) => {
        const earliestTime = this.now() + ms;
        if (!scheduledTimeout || scheduledTime < earliestTime) {
          reschedule(earliestTime);
        }
      },
      never: () => {
        unschedule();
      },
    };
  }

  // -----------------------------------------------------------------------
  // Private - Document Operations
  // -----------------------------------------------------------------------

  private fastIncorp(_n: number): void {
    this.incorporateUserChanges();
  }

  private setDocText(text: string): void {
    this.setDocAText(makeAText(text));
  }

  private setDocAText(atext: any): void {
    if (atext.text === '') {
      atext.text = '\n';
    }

    this.fastIncorp(8);

    if (this.rep.lines.length() === 0) {
      // No lines yet - bootstrap the initial empty line directly
      const oneEntry = this.createDomLineEntry('');
      oneEntry.width = 1; // newline char
      this.rep.lines.splice(0, 0, [oneEntry]);
      this.rep.alltext = '\n';
      this.rep.alines = splitAttributionLines(makeAttribution('\n'), '\n');
      this.insertDomLines(null, [oneEntry.domInfo]);
    }

    // Reset the edit event so the full doc replacement is captured cleanly for undo.
    // fastIncorp above may have created a partial backset from incorporateUserChanges
    // that has mismatched lengths with the changeset we're about to build.
    if (this.currentCallStack && this.currentCallStack.editEvent) {
      this.currentCallStack.editEvent.backset = null;
      this.currentCallStack.editEvent.changeset = null;
    }

    const currentOldLen = this.rep.lines.totalWidth();
    const numLines = this.rep.lines.length();
    const upToLastLine = this.rep.lines.offsetOfIndex(numLines - 1);
    const lastLineLength = (this.rep.lines.atIndex(numLines - 1) as any).text.length;
    const assem = new SmartOpAssembler();
    const o = new Op('-');
    o.chars = upToLastLine;
    o.lines = numLines - 1;
    assem.append(o);
    o.chars = lastLineLength;
    o.lines = 0;
    assem.append(o);
    for (const op of opsFromAText(atext)) assem.append(op);
    const newLen = currentOldLen + assem.getLengthChange();
    const changeset = checkRep(
      pack(currentOldLen, newLen, assem.toString(), atext.text.slice(0, -1)));
    this.performDocumentApplyChangeset(changeset);

    this.performSelectionChange(
      [0, (this.rep.lines.atIndex(0) as any).lineMarker],
      [0, (this.rep.lines.atIndex(0) as any).lineMarker]);

    this.idleWorkTimer.atMost(100);

    if (this.rep.alltext !== atext.text) {
      throw new Error('mismatch error setting raw text in setDocAText');
    }
  }

  private importText(text: string, undoable: boolean, dontProcess: boolean): void {
    let lines: string[];
    if (dontProcess) {
      if (text.charAt(text.length - 1) !== '\n') {
        throw new Error('new raw text must end with newline');
      }
      if (/[\r\t\xa0]/.exec(text)) {
        throw new Error('new raw text must not contain CR, tab, or nbsp');
      }
      lines = text.substring(0, text.length - 1).split('\n');
    } else {
      lines = text.split('\n').map((s) => this.textify(s));
    }
    let newText = '\n';
    if (lines.length > 0) {
      newText = `${lines.join('\n')}\n`;
    }

    this.inCallStackIfNecessary(`importText${undoable ? 'Undoable' : ''}`, () => {
      this.setDocText(newText);
    });

    if (dontProcess && this.rep.alltext !== text) {
      throw new Error('mismatch error setting raw text in importText');
    }
  }

  private importAText(atext: any, apoolJsonObj: any, undoable: boolean): void {
    atext = cloneAText(atext);
    if (apoolJsonObj) {
      const wireApool = (new AttribPool()).fromJsonable(apoolJsonObj);
      atext.attribs = moveOpsToNewPool(atext.attribs, wireApool, this.rep.apool);
    }
    this.inCallStackIfNecessary(`importText${undoable ? 'Undoable' : ''}`, () => {
      this.setDocAText(atext);
    });
  }

  private performDocumentReplaceRange(start: any, end: any, newText: string): void {
    if (start === undefined) start = this.rep.selStart;
    if (end === undefined) end = this.rep.selEnd;

    const builder = new Builder(this.rep.lines.totalWidth());
    buildKeepToStartOfRange(this.rep as any, builder, start);
    buildRemoveRange(this.rep as any, builder, start, end);
    builder.insert(newText, [
      ['author', this.thisAuthor],
    ], this.rep.apool);
    const cs = builder.toString();

    this.performDocumentApplyChangeset(cs);
  }

  private performDocumentReplaceSelection(newText: string): void {
    if (!(this.rep.selStart && this.rep.selEnd)) return;
    this.performDocumentReplaceRange(this.rep.selStart, this.rep.selEnd, newText);
  }

  private performDocumentReplaceCharRange(
    startChar: number, endChar: number, newText: string,
  ): void {
    if (startChar === endChar && newText.length === 0) return;

    if (endChar === this.rep.alltext.length) {
      if (startChar === endChar) {
        startChar--;
        endChar--;
        newText = `\n${newText.substring(0, newText.length - 1)}`;
      } else if (newText.length === 0) {
        startChar--;
        endChar--;
      } else {
        endChar--;
        newText = newText.substring(0, newText.length - 1);
      }
    }
    this.performDocumentReplaceRange(
      this.lineAndColumnFromChar(startChar),
      this.lineAndColumnFromChar(endChar),
      newText);
  }

  private performDocumentApplyAttributesToCharRange(
    start: number, end: number, attribs: any,
  ): void {
    end = Math.min(end, this.rep.alltext.length - 1);
    this.documentAttributeManager.setAttributesOnRange(
      this.lineAndColumnFromChar(start),
      this.lineAndColumnFromChar(end),
      attribs);
  }

  private performDocumentApplyChangeset(changes: string, insertsAfterSelection?: boolean): void {
    const domAndRepSplice = (startLine: number, deleteCount: number, newLineStrings: string[]) => {
      const keysToDelete: string[] = [];
      if (deleteCount > 0) {
        let entryToDelete: any = this.rep.lines.atIndex(startLine);
        for (let i = 0; i < deleteCount; i++) {
          keysToDelete.push(entryToDelete.key);
          entryToDelete = this.rep.lines.next(entryToDelete);
        }
      }

      const lineEntries = newLineStrings.map((s) => this.createDomLineEntry(s));

      this.doRepLineSplice(startLine, deleteCount, lineEntries);

      let nodeToAddAfter: Node | null;
      if (startLine > 0) {
        nodeToAddAfter = this.getCleanNodeByKey(this.rep.lines.atIndex(startLine - 1)!.key);
      } else {
        nodeToAddAfter = null;
      }

      this.insertDomLines(nodeToAddAfter, lineEntries.map((entry) => entry.domInfo));

      for (const k of keysToDelete) {
        const n = this.rootNode.getElementById(k);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      }

      if (
        (this.rep.selStart &&
          this.rep.selStart[0] >= startLine &&
          this.rep.selStart[0] <= startLine + deleteCount) ||
        (this.rep.selEnd &&
          this.rep.selEnd[0] >= startLine &&
          this.rep.selEnd[0] <= startLine + deleteCount)
      ) {
        this.currentCallStack.selectionAffected = true;
      }
    };

    this.doRepApplyChangeset(changes, insertsAfterSelection);

    let requiredSelectionSetting: any = null;
    if (this.rep.selStart && this.rep.selEnd) {
      const selStartChar = this.rep.lines.offsetOfIndex(this.rep.selStart[0]) +
        this.rep.selStart[1];
      const selEndChar = this.rep.lines.offsetOfIndex(this.rep.selEnd[0]) +
        this.rep.selEnd[1];
      const result = characterRangeFollow(
        changes, selStartChar, selEndChar, insertsAfterSelection ? 1 : 0);
      requiredSelectionSetting = [result[0], result[1], this.rep.selFocusAtStart];
    }

    const linesMutatee = {
      splice: (start: number, numRemoved: number, ...args: string[]) => {
        domAndRepSplice(start, numRemoved, args.map((s) => s.slice(0, -1)));
      },
      get: (i: number) => `${(this.rep.lines.atIndex(i) as any).text}\n`,
      length: () => this.rep.lines.length(),
    };

    mutateTextLines(changes, linesMutatee as any);

    if (requiredSelectionSetting) {
      this.performSelectionChange(
        this.lineAndColumnFromChar(requiredSelectionSetting[0]),
        this.lineAndColumnFromChar(requiredSelectionSetting[1]),
        requiredSelectionSetting[2]);
    }
  }

  private doRepApplyChangeset(changes: string, _insertsAfterSelection?: boolean): void {
    checkRep(changes);

    if (oldLen(changes) !== this.rep.alltext.length) {
      const errMsg = `${oldLen(changes)}/${this.rep.alltext.length}`;
      throw new Error(`doRepApplyChangeset length mismatch: ${errMsg}`);
    }

    const editEvent = this.currentCallStack.editEvent;
    if (editEvent.eventType === 'nonundoable') {
      if (!editEvent.changeset) {
        editEvent.changeset = changes;
      } else {
        editEvent.changeset = compose(editEvent.changeset, changes, this.rep.apool);
      }
    } else {
      const inverseChangeset = inverse(changes, {
        get: (i: number) => `${(this.rep.lines.atIndex(i) as any).text}\n`,
        length: () => this.rep.lines.length(),
      } as any, this.rep.alines, this.rep.apool);

      if (!editEvent.backset) {
        editEvent.backset = inverseChangeset;
      } else {
        editEvent.backset = compose(inverseChangeset, editEvent.backset, this.rep.apool);
      }
    }

    mutateAttributionLines(changes, this.rep.alines, this.rep.apool);

    // Track user changes for collaboration
    if (this.changesetTracker?.isTracking()) {
      this.changesetTracker.composeUserChangeset(changes);
    }
  }

  // -----------------------------------------------------------------------
  // Private - Line / Char Conversion
  // -----------------------------------------------------------------------

  private lineAndColumnFromChar(x: number): [number, number] {
    const lineEntry = this.rep.lines.atOffset(x)!;
    const lineStart = this.rep.lines.offsetOfEntry(lineEntry);
    const lineNum = this.rep.lines.indexOfEntry(lineEntry);
    return [lineNum, x - lineStart];
  }

  // -----------------------------------------------------------------------
  // Private - DOM Rendering
  // -----------------------------------------------------------------------

  private doCreateDomLine(nonEmpty: boolean): any {
    return (domline as any).createDomLine(nonEmpty, this.doesWrap, browser, this.targetDoc);
  }

  private createDomLineEntry(lineString: string): any {
    const info = this.doCreateDomLine(lineString.length > 0);
    const newNode = info.node;
    return {
      key: this.uniqueId(newNode),
      text: lineString,
      lineNode: newNode,
      domInfo: info,
      lineMarker: 0,
    };
  }

  private insertDomLines(nodeToAddAfter: Node | null, infoStructs: any[]): void {
    let lastEntry: any;
    let lineStartOffset = 0;
    for (const info of infoStructs) {
      const node = info.node;
      const key = this.uniqueId(node);
      let entry: any;
      if (lastEntry) {
        const next = this.rep.lines.next(lastEntry);
        if (next && next.key === key) {
          entry = next;
          lineStartOffset += lastEntry.width;
        }
      }
      if (!entry) {
        entry = this.rep.lines.atKey(key);
        lineStartOffset = this.rep.lines.offsetOfKey(key);
      }
      lastEntry = entry;
      this.getSpansForLine(entry, (tokenText: string, tokenClass: string) => {
        info.appendSpan(tokenText, tokenClass);
      }, lineStartOffset);
      info.prepareForAdd();
      entry.lineMarker = info.lineMarker;
      if (!nodeToAddAfter) {
        this.targetBody.insertBefore(node, this.targetBody.firstChild);
      } else {
        this.targetBody.insertBefore(node, (nodeToAddAfter as Element).nextSibling);
      }
      nodeToAddAfter = node;
      info.notifyAdded();
      this.markNodeClean(node);
    }
  }

  private recolorLinesInRange(startChar: number, endChar: number): void {
    if (endChar <= startChar) return;
    if (startChar < 0 || startChar >= this.rep.lines.totalWidth()) return;
    let lineEntry: any = this.rep.lines.atOffset(startChar);
    let lineStart = this.rep.lines.offsetOfEntry(lineEntry);
    let lineIndex = this.rep.lines.indexOfEntry(lineEntry);
    let selectionNeedsResetting = false;

    const tokenFunc = (tokenText: string, tokenClass: string) => {
      lineEntry.domInfo.appendSpan(tokenText, tokenClass);
    };

    while (lineEntry && lineStart < endChar) {
      const lineEnd = lineStart + lineEntry.width;
      lineEntry.domInfo.clearSpans();
      this.getSpansForLine(lineEntry, tokenFunc, lineStart);
      lineEntry.domInfo.finishUpdate();
      // Sync lineMarker from domInfo (e.g. heading lines have lineMarker=1)
      lineEntry.lineMarker = lineEntry.domInfo.lineMarker;

      this.markNodeClean(lineEntry.lineNode);

      if ((this.rep.selStart && this.rep.selStart[0] === lineIndex) ||
          (this.rep.selEnd && this.rep.selEnd[0] === lineIndex)) {
        selectionNeedsResetting = true;
      }

      lineStart = lineEnd;
      lineEntry = this.rep.lines.next(lineEntry);
      lineIndex++;
    }
    if (selectionNeedsResetting) {
      this.currentCallStack.selectionAffected = true;
    }
  }

  private getSpansForLine(
    lineEntry: any,
    textAndClassFunc: (text: string, cls: string) => void,
    lineEntryOffsetHint?: number,
  ): void {
    let lineEntryOffset = lineEntryOffsetHint;
    if (typeof lineEntryOffset !== 'number') {
      lineEntryOffset = this.rep.lines.offsetOfEntry(lineEntry);
    }
    const text = lineEntry.text;
    if (text.length === 0) {
      const func = (linestylefilter as any).getLineStyleFilter(
        0, '', textAndClassFunc, this.rep.apool);
      func('', '');
    } else {
      let filteredFunc = (linestylefilter as any).getFilterStack(text, textAndClassFunc, browser);
      const lineNum = this.rep.lines.indexOfEntry(lineEntry);
      const aline = this.rep.alines[lineNum];
      filteredFunc = (linestylefilter as any).getLineStyleFilter(
        text.length, aline, filteredFunc, this.rep.apool);
      filteredFunc(text, '');
    }
  }

  private recreateDOM(): void {
    this.recolorLinesInRange(0, this.rep.alltext.length);
  }

  // -----------------------------------------------------------------------
  // Private - Rep Splice
  // -----------------------------------------------------------------------

  private doRepLineSplice(
    startLine: number, deleteCount: number, newLineEntries: any[],
  ): void {
    for (const entry of newLineEntries) entry.width = entry.text.length + 1;

    const startOldChar = this.rep.lines.offsetOfIndex(startLine);
    const endOldChar = this.rep.lines.offsetOfIndex(startLine + deleteCount);

    this.rep.lines.splice(startLine, deleteCount, newLineEntries);
    if (this.currentCallStack) {
      this.currentCallStack.docTextChanged = true;
      this.currentCallStack.repChanged = true;
    }
    const newText = newLineEntries.map((e) => `${e.text}\n`).join('');

    this.rep.alltext = this.rep.alltext.substring(0, startOldChar) +
      newText + this.rep.alltext.substring(endOldChar, this.rep.alltext.length);
  }

  private doIncorpLineSplice(
    startLine: number, deleteCount: number,
    newLineEntries: any[], lineAttribs: any[], hints?: any,
  ): void {
    const startOldChar = this.rep.lines.offsetOfIndex(startLine);
    const endOldChar = this.rep.lines.offsetOfIndex(startLine + deleteCount);
    const oldRegionStart = this.rep.lines.offsetOfIndex(startLine);

    let selStartHintChar: number | undefined;
    let selEndHintChar: number | undefined;
    if (hints && hints.selStart) {
      selStartHintChar =
        this.rep.lines.offsetOfIndex(hints.selStart[0]) + hints.selStart[1] - oldRegionStart;
    }
    if (hints && hints.selEnd) {
      selEndHintChar =
        this.rep.lines.offsetOfIndex(hints.selEnd[0]) + hints.selEnd[1] - oldRegionStart;
    }

    const newText = newLineEntries.map((e) => `${e.text}\n`).join('');
    const oldText = this.rep.alltext.substring(startOldChar, endOldChar);
    const oldAttribs = this.rep.alines.slice(startLine, startLine + deleteCount).join('');
    const newAttribs = `${lineAttribs.join('|1+1')}|1+1`;
    const analysis = this.analyzeChange(
      oldText, newText, oldAttribs, newAttribs, selStartHintChar, selEndHintChar);
    const commonStart = analysis[0];
    let commonEnd = analysis[1];
    let shortOldText = oldText.substring(commonStart, oldText.length - commonEnd);
    let shortNewText = newText.substring(commonStart, newText.length - commonEnd);
    let spliceStart = startOldChar + commonStart;
    let spliceEnd = endOldChar - commonEnd;
    let shiftFinalNewlineToBeforeNewText = false;

    if (shortOldText.charAt(shortOldText.length - 1) === '\n' &&
        shortNewText.charAt(shortNewText.length - 1) === '\n') {
      shortOldText = shortOldText.slice(0, -1);
      shortNewText = shortNewText.slice(0, -1);
      spliceEnd--;
      commonEnd++;
    }
    if (shortOldText.length === 0 &&
        spliceStart === this.rep.alltext.length &&
        shortNewText.length > 0) {
      spliceStart--;
      spliceEnd--;
      shortNewText = `\n${shortNewText.slice(0, -1)}`;
      shiftFinalNewlineToBeforeNewText = true;
    }
    if (spliceEnd === this.rep.alltext.length &&
        shortOldText.length > 0 &&
        shortNewText.length === 0) {
      if (this.rep.alltext.charAt(spliceStart - 1) === '\n') {
        spliceStart--;
        spliceEnd--;
      }
    }

    if (!(shortOldText.length === 0 && shortNewText.length === 0)) {
      const oldDocText = this.rep.alltext;
      const docOldLen = oldDocText.length;

      const spliceStartLine = this.rep.lines.indexOfOffset(spliceStart);
      const spliceStartLineStart = this.rep.lines.offsetOfIndex(spliceStartLine);

      const startBuilder = () => {
        const builder = new Builder(docOldLen);
        builder.keep(spliceStartLineStart, spliceStartLine);
        builder.keep(spliceStart - spliceStartLineStart);
        return builder;
      };

      const eachAttribRun = (
        attribs: string,
        func: (start: number, end: number, attribs: string) => void,
      ) => {
        let textIndex = 0;
        const newTextStart = commonStart;
        const newTextEnd = newText.length - commonEnd -
          (shiftFinalNewlineToBeforeNewText ? 1 : 0);
        for (const op of deserializeOps(attribs)) {
          const nextIndex = textIndex + op.chars;
          if (!(nextIndex <= newTextStart || textIndex >= newTextEnd)) {
            func(
              Math.max(newTextStart, textIndex),
              Math.min(newTextEnd, nextIndex),
              op.attribs);
          }
          textIndex = nextIndex;
        }
      };

      const justApplyStyles = (shortNewText === shortOldText);
      let theChangeset: string;

      if (justApplyStyles) {
        const incorpedAttribClearer = this.cachedStrFunc(
          (oldAtts: string) => mapAttribNumbers(oldAtts, (n: number) => {
            const k = this.rep.apool.getAttribKey(n);
            if (this.isStyleAttribute(k)) {
              return this.rep.apool.putAttrib([k, '']);
            }
            return false;
          }));

        const builder1 = startBuilder();
        if (shiftFinalNewlineToBeforeNewText) {
          builder1.keep(1, 1);
        }
        eachAttribRun(oldAttribs, (start, end, attribs) => {
          builder1.keepText(newText.substring(start, end), incorpedAttribClearer(attribs));
        });
        const clearer = builder1.toString();

        const builder2 = startBuilder();
        if (shiftFinalNewlineToBeforeNewText) {
          builder2.keep(1, 1);
        }
        eachAttribRun(newAttribs, (start, end, attribs) => {
          builder2.keepText(newText.substring(start, end), attribs);
        });
        const styler = builder2.toString();

        theChangeset = compose(clearer, styler, this.rep.apool);
      } else {
        const builder = startBuilder();

        const spliceEndLine = this.rep.lines.indexOfOffset(spliceEnd);
        const spliceEndLineStart = this.rep.lines.offsetOfIndex(spliceEndLine);
        if (spliceEndLineStart > spliceStart) {
          builder.remove(
            spliceEndLineStart - spliceStart, spliceEndLine - spliceStartLine);
          builder.remove(spliceEnd - spliceEndLineStart);
        } else {
          builder.remove(spliceEnd - spliceStart);
        }

        let isNewTextMultiauthor = false;
        const authorizer = this.cachedStrFunc((oldAtts: string) => {
          const attribs = AttributeMap.fromString(oldAtts, this.rep.apool);
          if (!isNewTextMultiauthor || !attribs.has('author')) {
            attribs.set('author', this.thisAuthor);
          }
          return attribs.toString();
        });

        let foundDomAuthor = '';
        eachAttribRun(newAttribs, (_start, _end, attribs) => {
          const a = AttributeMap.fromString(attribs, this.rep.apool).get('author');
          if (a && a !== foundDomAuthor) {
            if (!foundDomAuthor) {
              foundDomAuthor = a;
            } else {
              isNewTextMultiauthor = true;
            }
          }
        });

        if (shiftFinalNewlineToBeforeNewText) {
          builder.insert('\n', authorizer(''));
        }

        eachAttribRun(newAttribs, (start, end, attribs) => {
          builder.insert(newText.substring(start, end), authorizer(attribs));
        });
        theChangeset = builder.toString();
      }

      this.doRepApplyChangeset(theChangeset);
    }

    this.doRepLineSplice(startLine, deleteCount, newLineEntries);
  }

  // -----------------------------------------------------------------------
  // Private - Change Analysis
  // -----------------------------------------------------------------------

  private analyzeChange(
    oldText: string, newText: string,
    oldAttribs: string, newAttribs: string,
    _optSelStartHint?: number, optSelEndHint?: number,
  ): [number, number] {
    const incorpedAttribFilter = (anum: number) =>
      !this.isDefaultLineAttribute(this.rep.apool.getAttribKey(anum));

    const attribRuns = (attribs: string) => {
      const lengs: number[] = [];
      const atts: string[] = [];
      for (const op of deserializeOps(attribs)) {
        lengs.push(op.chars);
        atts.push(op.attribs);
      }
      return [lengs, atts];
    };

    const attribIterator = (runs: any, backward: boolean) => {
      const lengs = runs[0];
      const atts = runs[1];
      let i = backward ? lengs.length - 1 : 0;
      let j = 0;
      const next = () => {
        while (j >= lengs[i]) {
          if (backward) i--;
          else i++;
          j = 0;
        }
        const a = atts[i];
        j++;
        return a;
      };
      return next;
    };

    const oldTextLen = oldText.length;
    const newTextLen = newText.length;
    const minLen = Math.min(oldTextLen, newTextLen);

    const oldARuns = attribRuns(filterAttribNumbers(oldAttribs, incorpedAttribFilter));
    const newARuns = attribRuns(filterAttribNumbers(newAttribs, incorpedAttribFilter));

    let commonStart = 0;
    const oldStartIter = attribIterator(oldARuns, false);
    const newStartIter = attribIterator(newARuns, false);
    while (commonStart < minLen) {
      if (oldText.charAt(commonStart) === newText.charAt(commonStart) &&
          oldStartIter() === newStartIter()) {
        commonStart++;
      } else {
        break;
      }
    }

    let commonEnd = 0;
    const oldEndIter = attribIterator(oldARuns, true);
    const newEndIter = attribIterator(newARuns, true);
    while (commonEnd < minLen) {
      if (commonEnd === 0) {
        oldEndIter();
        newEndIter();
        commonEnd++;
      } else if (
        oldText.charAt(oldTextLen - 1 - commonEnd) ===
          newText.charAt(newTextLen - 1 - commonEnd) &&
        oldEndIter() === newEndIter()
      ) {
        commonEnd++;
      } else {
        break;
      }
    }

    let hintedCommonEnd = -1;
    if (typeof optSelEndHint === 'number') {
      hintedCommonEnd = newTextLen - optSelEndHint;
    }

    if (commonStart + commonEnd > oldTextLen) {
      const minCommonEnd = oldTextLen - commonStart;
      const maxCommonEnd = commonEnd;
      if (hintedCommonEnd >= minCommonEnd && hintedCommonEnd <= maxCommonEnd) {
        commonEnd = hintedCommonEnd;
      } else {
        commonEnd = minCommonEnd;
      }
      commonStart = oldTextLen - commonEnd;
    }
    if (commonStart + commonEnd > newTextLen) {
      const minCommonEnd = newTextLen - commonStart;
      const maxCommonEnd = commonEnd;
      if (hintedCommonEnd >= minCommonEnd && hintedCommonEnd <= maxCommonEnd) {
        commonEnd = hintedCommonEnd;
      } else {
        commonEnd = minCommonEnd;
      }
      commonStart = newTextLen - commonEnd;
    }

    return [commonStart, commonEnd];
  }

  private cachedStrFunc(func: (s: string) => string): (s: string) => string {
    const cache: Record<string, string> = {};
    return (s: string) => {
      if (!cache[s]) {
        cache[s] = func(s);
      }
      return cache[s];
    };
  }

  // -----------------------------------------------------------------------
  // Private - Content Collection / Change Detection
  // -----------------------------------------------------------------------

  private incorporateUserChanges(): boolean {
    if (this.currentCallStack && this.currentCallStack.domClean) return false;

    if (this.currentCallStack) {
      this.currentCallStack.isUserChange = true;
    }

    if (!this.targetBody.firstChild) {
      this.targetBody.innerHTML = '<div><!-- --></div>';
    }

    try {
    this.observeChangesAroundSelection();
    this.observeSuspiciousNodes();
    let dirtyRanges = this.getDirtyRanges();
    let dirtyRangesCheckOut = true;
    let j = 0;
    let a: number, b: number;

    while (j < dirtyRanges.length) {
      a = dirtyRanges[j][0];
      b = dirtyRanges[j][1];
      if (!((a === 0 || this.getCleanNodeByKey(this.rep.lines.atIndex(a - 1)!.key)) &&
          (b === this.rep.lines.length() ||
           this.getCleanNodeByKey(this.rep.lines.atIndex(b)!.key)))) {
        dirtyRangesCheckOut = false;
        break;
      }
      j++;
    }
    if (!dirtyRangesCheckOut) {
      for (const bodyNode of this.targetBody.childNodes) {
        if ((bodyNode as Element).tagName &&
            (!(bodyNode as Element).id ||
             !this.rep.lines.containsKey((bodyNode as Element).id))) {
          this.observeChangesAroundNode(bodyNode as Element);
        }
      }
      dirtyRanges = this.getDirtyRanges();
    }

    this.clearObservedChanges();

    const selection = this.getSelection();

    let selStart: any;
    let selEnd: any;
    let i = 0;
    const splicesToDo: any[] = [];
    let netNumLinesChangeSoFar = 0;
    const toDeleteAtEnd: Node[] = [];
    const domInsertsNeeded: any[] = [];

    while (i < dirtyRanges.length) {
      const range = dirtyRanges[i];
      a = range[0];
      b = range[1];
      let firstDirtyNode: any = ((a === 0 && this.targetBody.firstChild) ||
        this.getCleanNodeByKey(this.rep.lines.atIndex(a - 1)!.key)?.nextSibling);
      firstDirtyNode = (firstDirtyNode && this.isNodeDirty(firstDirtyNode) && firstDirtyNode);

      let lastDirtyNode: any = ((b === this.rep.lines.length() && this.targetBody.lastChild) ||
        this.getCleanNodeByKey(this.rep.lines.atIndex(b)!.key)?.previousSibling);
      lastDirtyNode = (lastDirtyNode && this.isNodeDirty(lastDirtyNode) && lastDirtyNode);

      if (firstDirtyNode && lastDirtyNode) {
        const cc: any = makeContentCollector(
          this.isStyled, browser, this.rep.apool, this.className2Author.bind(this) as any);
        cc.notifySelection(selection);
        const dirtyNodes: Node[] = [];
        for (let n = firstDirtyNode;
          n && !(n.previousSibling && n.previousSibling === lastDirtyNode);
          n = n.nextSibling) {
          cc.collectContent(n);
          dirtyNodes.push(n);
        }
        cc.notifyNextNode(lastDirtyNode.nextSibling);
        let lines = cc.getLines();
        if ((lines.length <= 1 || lines[lines.length - 1] !== '') &&
            lastDirtyNode.nextSibling) {
          b++;
          const cleanLine = lastDirtyNode.nextSibling;
          cc.collectContent(cleanLine);
          toDeleteAtEnd.push(cleanLine);
          cc.notifyNextNode(cleanLine.nextSibling);
        }

        const ccData = cc.finish();
        const ss = ccData.selStart;
        const se = ccData.selEnd;
        lines = ccData.lines;
        const lineAttribs = ccData.lineAttribs;
        const linesWrapped = ccData.linesWrapped;

        if (linesWrapped > 0) {
          // Scroll to left needed to fix Chrome wrapping issue
          this.targetBody.scrollLeft = 0;
        }

        if (ss[0] >= 0) selStart = [ss[0] + a + netNumLinesChangeSoFar, ss[1]];
        if (se[0] >= 0) selEnd = [se[0] + a + netNumLinesChangeSoFar, se[1]];

        const entries: any[] = [];
        const nodeToAddAfter = lastDirtyNode;
        const lineNodeInfos: any[] = [];
        for (const lineString of lines) {
          const newEntry = this.createDomLineEntry(lineString);
          entries.push(newEntry);
          lineNodeInfos.push(newEntry.domInfo);
        }
        domInsertsNeeded.push([nodeToAddAfter, lineNodeInfos]);
        for (const n of dirtyNodes) toDeleteAtEnd.push(n);
        const spliceHints: any = {};
        if (selStart) spliceHints.selStart = selStart;
        if (selEnd) spliceHints.selEnd = selEnd;
        splicesToDo.push([
          a + netNumLinesChangeSoFar, b - a, entries, lineAttribs, spliceHints]);
        netNumLinesChangeSoFar += (lines.length - (b - a));
      } else if (b > a) {
        splicesToDo.push([a + netNumLinesChangeSoFar, b - a, [], []]);
      }
      i++;
    }

    const domChanges = splicesToDo.length > 0;

    for (const splice of splicesToDo) this.doIncorpLineSplice(splice[0], splice[1], splice[2], splice[3], splice[4]);
    for (const ins of domInsertsNeeded) this.insertDomLines(ins[0], ins[1]);
    for (const n of toDeleteAtEnd) (n as Element).remove();

    // If selection nodes weren't encountered during content collection,
    // figure out where those nodes are now.
    if (selection && !selStart) {
      selStart = this.getLineAndCharForPoint(selection.startPoint);
    }
    if (selection && !selEnd) {
      selEnd = this.getLineAndCharForPoint(selection.endPoint);
    }

    // Cap selection to valid line range
    const numLines = this.rep.lines.length();
    if (numLines > 0) {
      if (selStart && selStart[0] >= numLines) {
        selStart[0] = numLines - 1;
        selStart[1] = (this.rep.lines.atIndex(selStart[0]) as any).text.length;
      }
      if (selEnd && selEnd[0] >= numLines) {
        selEnd[0] = numLines - 1;
        selEnd[1] = (this.rep.lines.atIndex(selEnd[0]) as any).text.length;
      }
    } else {
      selStart = null;
      selEnd = null;
    }

    if (selection) {
      this.repSelectionChange(selStart, selEnd, selection && selection.focusAtStart);
    }
    if (selection && (domChanges || this.isCaret())) {
      if (this.currentCallStack) {
        this.currentCallStack.selectionAffected = true;
      }
    }

    if (this.currentCallStack) {
      this.currentCallStack.domClean = true;
    }

    return domChanges;
    } catch (e) {
      // Guard against DOM/rep desync crashes (e.g. node IDs not in SkipList).
      // Mark clean so the idle timer doesn't spin indefinitely.
      if (this.currentCallStack) {
        this.currentCallStack.domClean = true;
      }
      return false;
    }
  }

  private getDirtyRanges(): [number, number][] {
    const cleanNodeForIndexCache: Record<number, any> = {};
    const N = this.rep.lines.length();

    const cleanNodeForIndex = (i: number): any => {
      if (cleanNodeForIndexCache[i] === undefined) {
        let result: any;
        if (i < 0 || i >= N) {
          result = true;
        } else {
          const key = this.rep.lines.atIndex(i)!.key;
          result = this.getCleanNodeByKey(key) || false;
        }
        cleanNodeForIndexCache[i] = result;
      }
      return cleanNodeForIndexCache[i];
    };

    const isConsecutiveCache: Record<number, boolean> = {};

    const isConsecutive = (i: number): boolean => {
      if (isConsecutiveCache[i] === undefined) {
        isConsecutiveCache[i] = (() => {
          const a = cleanNodeForIndex(i - 1);
          const b = cleanNodeForIndex(i);
          if (!a || !b) return false;
          if (a === true && b === true) return !this.targetBody.firstChild;
          if (a === true && b.previousSibling) return false;
          if (b === true && a.nextSibling) return false;
          if (a === true || b === true) return true;
          return a.nextSibling === b;
        })();
      }
      return isConsecutiveCache[i];
    };

    const isClean = (i: number): boolean => !!cleanNodeForIndex(i);

    const cleanRanges: [number, number][] = [[-1, N + 1]];

    const rangeForLine = (i: number): number => {
      for (const [idx, r] of cleanRanges.entries()) {
        if (i < r[0]) return -1;
        if (i < r[1]) return idx;
      }
      return -1;
    };

    const removeLineFromRange = (rng: number, line: number): void => {
      const a = cleanRanges[rng][0];
      const b = cleanRanges[rng][1];
      if (a + 1 === b) cleanRanges.splice(rng, 1);
      else if (line === a) cleanRanges[rng][0]++;
      else if (line === b - 1) cleanRanges[rng][1]--;
      else cleanRanges.splice(rng, 1, [a, line], [line + 1, b]);
    };

    const splitRange = (rng: number, pt: number): void => {
      const a = cleanRanges[rng][0];
      const b = cleanRanges[rng][1];
      cleanRanges.splice(rng, 1, [a, pt], [pt, b]);
    };

    const correctedLines: Record<number, boolean> = {};

    const correctlyAssignLine = (line: number): boolean => {
      if (correctedLines[line]) return true;
      correctedLines[line] = true;
      const rng = rangeForLine(line);
      const lineClean = isClean(line);
      if (rng < 0) {
        return true;
      }
      if (!lineClean) {
        removeLineFromRange(rng, line);
        return false;
      } else {
        const a = cleanRanges[rng][0];
        const b = cleanRanges[rng][1];
        let didSomething = false;
        if (a < line && isClean(line - 1) && !isConsecutive(line)) {
          splitRange(rng, line);
          didSomething = true;
        }
        if (b > line + 1 && isClean(line + 1) && !isConsecutive(line + 1)) {
          splitRange(rng, line + 1);
          didSomething = true;
        }
        return !didSomething;
      }
    };

    const detectChangesAroundLine = (line: number, reqInARow: number): void => {
      let correctInARow = 0;
      let currentIndex = line;
      while (correctInARow < reqInARow && currentIndex >= 0) {
        if (correctlyAssignLine(currentIndex)) {
          correctInARow++;
        } else {
          correctInARow = 0;
        }
        currentIndex--;
      }
      correctInARow = 0;
      currentIndex = line;
      while (correctInARow < reqInARow && currentIndex < N) {
        if (correctlyAssignLine(currentIndex)) {
          correctInARow++;
        } else {
          correctInARow = 0;
        }
        currentIndex++;
      }
    };

    if (N === 0) {
      if (!isConsecutive(0)) {
        splitRange(0, 0);
      }
    } else {
      detectChangesAroundLine(0, 1);
      detectChangesAroundLine(N - 1, 1);

      for (const k of Object.keys(this.observedChanges.cleanNodesNearChanges)) {
        const key = k.substring(1);
        if (this.rep.lines.containsKey(key)) {
          const line = this.rep.lines.indexOfKey(key);
          detectChangesAroundLine(line, 2);
        }
      }
    }

    const dirtyRanges: [number, number][] = [];
    for (let r = 0; r < cleanRanges.length - 1; r++) {
      dirtyRanges.push([cleanRanges[r][1], cleanRanges[r + 1][0]]);
    }

    return dirtyRanges;
  }

  // -----------------------------------------------------------------------
  // Private - Node Tracking
  // -----------------------------------------------------------------------

  private uniqueId(n: any): string {
    const nid = n.id;
    if (nid) return nid;
    return (n.id = `magicdomid${this._nextId++}`);
  }

  private topLevel(n: Node | null): Node | null {
    if (!n || n === this.targetBody) return null;
    while (n.parentNode !== this.targetBody) {
      n = n.parentNode;
      if (!n) return null;
    }
    return n;
  }

  private markNodeClean(n: any): void {
    setAssoc(n, 'dirtiness', {nodeId: this.uniqueId(n), knownHTML: n.innerHTML} as any);
  }

  private isNodeDirty(n: any): boolean {
    if (n.parentNode !== this.targetBody) return true;
    const data = getAssoc(n, 'dirtiness');
    if (!data) return true;
    if (n.id !== data.nodeId) return true;
    if (n.innerHTML !== data.knownHTML) return true;
    return false;
  }

  private getCleanNodeByKey(key: string): HTMLElement | null {
    let n = this.rootNode.getElementById(key);
    while (n && this.isNodeDirty(n)) {
      n.id = '';
      n = this.rootNode.getElementById(key);
    }
    return n;
  }

  private clearObservedChanges(): void {
    this.observedChanges = {
      cleanNodesNearChanges: {},
    };
  }

  private observeChangesAroundNode(node: Node): void {
    let cleanNode: Node | null = null;
    let hasAdjacentDirtyness = false;

    if (!this.isNodeDirty(node)) {
      cleanNode = node;
      const prevSib = cleanNode.previousSibling;
      const nextSib = cleanNode.nextSibling;
      hasAdjacentDirtyness = !!(
        (prevSib && this.isNodeDirty(prevSib)) ||
        (nextSib && this.isNodeDirty(nextSib))
      );
    } else {
      let upNode = node.previousSibling;
      while (upNode && this.isNodeDirty(upNode)) {
        upNode = upNode.previousSibling;
      }
      if (upNode) {
        cleanNode = upNode;
      } else {
        let downNode = node.nextSibling;
        while (downNode && this.isNodeDirty(downNode)) {
          downNode = downNode.nextSibling;
        }
        if (downNode) {
          cleanNode = downNode;
        }
      }
      if (!cleanNode) return;
      hasAdjacentDirtyness = true;
    }

    if (hasAdjacentDirtyness) {
      this.observedChanges.cleanNodesNearChanges[`$${this.uniqueId(cleanNode)}`] = true;
    } else {
      const lineKey = this.uniqueId(cleanNode);
      if (!this.rep.lines.containsKey(lineKey)) return;
      const prevSib = cleanNode!.previousSibling;
      const nextSib = cleanNode!.nextSibling;
      const actualPrevKey = (prevSib && this.uniqueId(prevSib)) || null;
      const actualNextKey = (nextSib && this.uniqueId(nextSib)) || null;
      const repPrevEntry = this.rep.lines.prev(this.rep.lines.atKey(lineKey)!);
      const repNextEntry = this.rep.lines.next(this.rep.lines.atKey(lineKey)!);
      const repPrevKey = (repPrevEntry && repPrevEntry.key) || null;
      const repNextKey = (repNextEntry && repNextEntry.key) || null;
      if (actualPrevKey !== repPrevKey || actualNextKey !== repNextKey) {
        this.observedChanges.cleanNodesNearChanges[`$${this.uniqueId(cleanNode)}`] = true;
      }
    }
  }

  private observeChangesAroundSelection(): void {
    if (this.currentCallStack && this.currentCallStack.observedSelection) return;
    if (this.currentCallStack) this.currentCallStack.observedSelection = true;

    const selection = this.getSelection();

    if (selection) {
      const node1 = this.topLevel(selection.startPoint.node);
      const node2 = this.topLevel(selection.endPoint.node);
      if (node1) this.observeChangesAroundNode(node1);
      if (node2 && node1 !== node2) {
        this.observeChangesAroundNode(node2);
      }
    }
  }

  private observeSuspiciousNodes(): void {
    if (this.targetBody.getElementsByTagName) {
      const elts = this.targetBody.getElementsByTagName('style');
      for (const elt of elts) {
        const n = this.topLevel(elt);
        if (n && n.parentNode === this.targetBody) {
          this.observeChangesAroundNode(n);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private - Selection
  // -----------------------------------------------------------------------

  private nodeMaxIndex(nd: Node): number {
    if (isNodeText(nd)) return (nd as Text).nodeValue!.length;
    return 1;
  }

  private nodeText(n: Node): string {
    return (n as any).textContent || (n as any).nodeValue || '';
  }

  private childIndex(n: Node): number {
    let idx = 0;
    while (n.previousSibling) {
      idx++;
      n = n.previousSibling;
    }
    return idx;
  }

  private getDocSelection(): Selection | null {
    // In Shadow DOM, try shadowRoot.getSelection (Chrome-specific) first,
    // then fall back to document.getSelection which works for shadow DOM in Chromium.
    if (this.rootNode instanceof ShadowRoot) {
      const sr = this.rootNode as any;
      if (typeof sr.getSelection === 'function') {
        return sr.getSelection();
      }
    }
    return this.targetDoc.getSelection();
  }

  private getSelection(): any {
    const browserSelection = this.getDocSelection();
    if (!browserSelection || browserSelection.type === 'None' ||
        browserSelection.rangeCount === 0) {
      return null;
    }
    const range = browserSelection.getRangeAt(0);

    const isInBody = (n: Node | null): boolean => {
      while (n) {
        if (n === this.targetBody) return true;
        n = n.parentNode;
      }
      return false;
    };

    const pointFromRangeBound = (container: Node, offset: number): any => {
      if (!isInBody(container)) {
        return {
          node: this.targetBody,
          index: 0,
          maxIndex: 1,
        };
      }
      const n = container;
      const childCount = n.childNodes.length;
      if (isNodeText(n)) {
        return {
          node: n,
          index: offset,
          maxIndex: (n as Text).nodeValue!.length,
        };
      } else if (childCount === 0) {
        return {
          node: n,
          index: 0,
          maxIndex: 1,
        };
      } else if (offset === childCount) {
        const nd = n.childNodes.item(childCount - 1);
        const max = this.nodeMaxIndex(nd!);
        return {
          node: nd,
          index: max,
          maxIndex: max,
        };
      } else {
        const nd = n.childNodes.item(offset);
        const max = this.nodeMaxIndex(nd!);
        return {
          node: nd,
          index: 0,
          maxIndex: max,
        };
      }
    };

    const selection = {
      startPoint: pointFromRangeBound(range.startContainer, range.startOffset),
      endPoint: pointFromRangeBound(range.endContainer, range.endOffset),
      focusAtStart:
        (range.startContainer !== range.endContainer ||
         range.startOffset !== range.endOffset) &&
        browserSelection.anchorNode &&
        browserSelection.anchorNode === range.endContainer &&
        browserSelection.anchorOffset === range.endOffset,
    };

    if (selection.startPoint.node.ownerDocument !== this.targetDoc) {
      return null;
    }

    return selection;
  }

  private setSelection(selection: any): void {
    const copyPoint = (pt: any) => ({
      node: pt.node,
      index: pt.index,
      maxIndex: pt.maxIndex,
    });
    let isCollapsed: boolean;

    const pointToRangeBound = (pt: any) => {
      const p = copyPoint(pt);
      if (isCollapsed) {
        const diveDeep = () => {
          while (p.node.childNodes.length > 0) {
            if (p.index === 0) {
              p.node = p.node.firstChild;
              p.maxIndex = this.nodeMaxIndex(p.node);
            } else if (p.index === p.maxIndex) {
              p.node = p.node.lastChild;
              p.maxIndex = this.nodeMaxIndex(p.node);
              p.index = p.maxIndex;
            } else {
              break;
            }
          }
        };
        if (isNodeText(p.node) && p.index === p.maxIndex) {
          let n = p.node;
          while (!n.nextSibling && n !== this.targetBody && n.parentNode !== this.targetBody) {
            n = n.parentNode;
          }
          if (n.nextSibling &&
              !(typeof n.nextSibling.tagName === 'string' &&
                n.nextSibling.tagName.toLowerCase() === 'br') &&
              n !== p.node && n !== this.targetBody && n.parentNode !== this.targetBody) {
            p.node = n.nextSibling;
            p.maxIndex = this.nodeMaxIndex(p.node);
            p.index = 0;
            diveDeep();
          }
        }
        if (!isNodeText(p.node)) {
          diveDeep();
        }
      }
      if (isNodeText(p.node)) {
        return {
          container: p.node,
          offset: p.index,
        };
      } else {
        return {
          container: p.node.parentNode,
          offset: this.childIndex(p.node) + p.index,
        };
      }
    };

    const browserSelection = this.getDocSelection();
    if (browserSelection) {
      browserSelection.removeAllRanges();
      if (selection) {
        isCollapsed = (
          selection.startPoint.node === selection.endPoint.node &&
          selection.startPoint.index === selection.endPoint.index
        );
        const start = pointToRangeBound(selection.startPoint);
        const end = pointToRangeBound(selection.endPoint);

        if (!isCollapsed && selection.focusAtStart &&
            browserSelection.collapse && browserSelection.extend) {
          browserSelection.collapse(end.container, end.offset);
          browserSelection.extend(start.container, start.offset);
        } else {
          const range = this.targetDoc.createRange();
          range.setStart(start.container, start.offset);
          range.setEnd(end.container, end.offset);
          browserSelection.removeAllRanges();
          browserSelection.addRange(range);
        }
      }
    }
  }

  private getPointForLineAndChar(lineAndChar: [number, number]): any {
    const line = lineAndChar[0];
    let charsLeft = lineAndChar[1];
    const lineEntry: any = this.rep.lines.atIndex(line);
    charsLeft -= lineEntry.lineMarker;
    if (charsLeft < 0) {
      charsLeft = 0;
    }
    const lineNode = lineEntry.lineNode;
    let n = lineNode;
    let after = false;
    if (charsLeft === 0) {
      return {
        node: lineNode,
        index: 0,
        maxIndex: 1,
      };
    }
    while (!(n === lineNode && after)) {
      if (after) {
        if (n.nextSibling) {
          n = n.nextSibling;
          after = false;
        } else {
          n = n.parentNode;
        }
      } else if (isNodeText(n)) {
        const len = n.nodeValue.length;
        if (charsLeft <= len) {
          return {
            node: n,
            index: charsLeft,
            maxIndex: len,
          };
        }
        charsLeft -= len;
        after = true;
      } else if (n.firstChild) {
        n = n.firstChild;
      } else {
        after = true;
      }
    }
    return {
      node: lineNode,
      index: 1,
      maxIndex: 1,
    };
  }

  private getLineAndCharForPoint(point: any): [number, number] {
    const N = this.rep.lines.length();
    if (N === 0) return [0, 0];
    if (point.node === this.targetBody) {
      if (point.index === 0) {
        return [0, 0];
      } else {
        const ln: any = this.rep.lines.atIndex(N - 1);
        if (!ln) return [0, 0];
        return [N - 1, ln.text.length];
      }
    } else {
      let n = point.node;
      let col = 0;
      if (isNodeText(n)) {
        col = point.index;
      } else if (point.index > 0) {
        col = this.nodeText(n).length;
      }
      let parNode: Node | null;
      let prevSib: Node | null;
      while (n && (parNode = n.parentNode) && parNode !== this.targetBody) {
        if ((prevSib = n.previousSibling)) {
          n = prevSib;
          col += this.nodeText(n).length;
        } else {
          n = parNode;
        }
      }
      if (!n || !n.parentNode) {
        // Node not found in targetBody, return safe default
        return [0, 0];
      }
      const lineEntry: any = n.id ? this.rep.lines.atKey(n.id) : null;
      if (!lineEntry) return [0, 0];
      // Use the actual lineMarker from rep (set by domline during rendering).
      // This correctly accounts for plugin block elements (h1-h6, etc.)
      // without needing a hardcoded list of block element tags.
      col += lineEntry.lineMarker;
      const lineNum = this.rep.lines.indexOfEntry(lineEntry);
      return [lineNum, col];
    }
  }

  private performSelectionChange(
    selectStart: any, selectEnd: any, focusAtStart?: boolean,
  ): void {
    if (this.repSelectionChange(selectStart, selectEnd, focusAtStart)) {
      if (this.currentCallStack) {
        this.currentCallStack.selectionAffected = true;
      }
    }
  }

  private repSelectionChange(
    selectStart: any, selectEnd: any, focusAtStart?: boolean,
  ): boolean {
    focusAtStart = !!focusAtStart;

    const newSelFocusAtStart = focusAtStart && (
      !selectStart ||
      !selectEnd ||
      selectStart[0] !== selectEnd[0] ||
      selectStart[1] !== selectEnd[1]
    );

    if (!this.equalLineAndChars(this.rep.selStart, selectStart) ||
        !this.equalLineAndChars(this.rep.selEnd, selectEnd) ||
        this.rep.selFocusAtStart !== newSelFocusAtStart) {
      this.rep.selStart = selectStart;
      this.rep.selEnd = selectEnd;
      this.rep.selFocusAtStart = newSelFocusAtStart;
      if (this.currentCallStack) {
        this.currentCallStack.repChanged = true;
      }

      // Emit selection changed event
      if (this.rep.selStart && this.rep.selEnd) {
        editorBus.emit('editor:selection:changed', {
          start: [this.rep.selStart[0], this.rep.selStart[1]] as [number, number],
          end: [this.rep.selEnd[0], this.rep.selEnd[1]] as [number, number],
        });
        if (this.onSelectionChanged) this.onSelectionChanged(this.rep.selStart, this.rep.selEnd);
      }

      return true;
    }
    return false;
  }

  private updateBrowserSelectionFromRep(): void {
    // Don't steal focus from other UI elements (dropdowns, selects, inputs, etc.).
    // In the old iframe approach this wasn't needed because the editor had its own
    // document. Now that the editor is in the main document, setting the selection
    // here would close native <select> dropdowns and blur focused inputs.
    const active = document.activeElement;
    if (active && active !== this.targetBody && !this.targetBody.contains(active)) {
      return;
    }

    const selStart = this.rep.selStart;
    const selEnd = this.rep.selEnd;

    if (!(selStart && selEnd)) {
      this.setSelection(null);
      return;
    }

    const selection: any = {};
    const ss = [selStart[0], selStart[1]] as [number, number];
    selection.startPoint = this.getPointForLineAndChar(ss);
    const se = [selEnd[0], selEnd[1]] as [number, number];
    selection.endPoint = this.getPointForLineAndChar(se);
    selection.focusAtStart = !!this.rep.selFocusAtStart;
    this.setSelection(selection);
  }

  private equalLineAndChars(a: any, b: any): boolean {
    if (!a) return !b;
    if (!b) return !a;
    return a[0] === b[0] && a[1] === b[1];
  }

  // -----------------------------------------------------------------------
  // Private - Input Handling
  // -----------------------------------------------------------------------

  private handleKeyEvent(evt: KeyboardEvent): void {
    if (!this.isEditable) return;

    // Invoke external key handlers
    if (evt.type === 'keypress' && this.onKeyPressHandler) {
      this.onKeyPressHandler(evt);
    }
    if (evt.type === 'keydown' && this.onKeyDownHandler) {
      this.onKeyDownHandler(evt);
    }

    const {type, charCode, keyCode, which} = evt as any;

    let altKey = evt.altKey;
    if (typeof evt.location === 'number') {
      altKey = altKey && evt.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT;
    }

    const isModKey = !charCode && (type === 'keyup' || type === 'keydown') &&
      (keyCode === 16 || keyCode === 17 || keyCode === 18 ||
       keyCode === 20 || keyCode === 224 || keyCode === 91);
    if (isModKey) return;

    if (keyCode === 13 && browser.opera && type === 'keypress') return;

    const isTypeForSpecialKey = browser.safari || browser.chrome || browser.firefox
      ? type === 'keydown' : type === 'keypress';
    const isTypeForCmdKey = browser.safari || browser.chrome || browser.firefox
      ? type === 'keydown' : type === 'keypress';

    let stopped = false;

    this.inCallStackIfNecessary('handleKeyEvent', () => {
      if (type === 'keypress' || (isTypeForSpecialKey && keyCode === 13)) {
        // Default: allow keypress
      } else if (evt.key === 'Dead') {
        stopped = true;
        return true;
      }

      let specialHandled = false;

      if (!stopped) {
        // Delete/Backspace
        if (!specialHandled && isTypeForSpecialKey && keyCode === 8) {
          this.fastIncorp(3);
          evt.preventDefault();
          this.doDeleteKey(evt);
          specialHandled = true;
        }
        // Return
        if (!specialHandled && isTypeForSpecialKey && keyCode === 13) {
          this.fastIncorp(4);
          evt.preventDefault();
          this.doReturnKey();
          specialHandled = true;
        }
        // Escape
        if (!specialHandled && isTypeForSpecialKey && keyCode === 27) {
          this.fastIncorp(4);
          evt.preventDefault();
          specialHandled = true;
        }
        // Tab
        if (!specialHandled && isTypeForSpecialKey && keyCode === 9 &&
            !(evt.metaKey || evt.ctrlKey)) {
          this.fastIncorp(5);
          evt.preventDefault();
          this.doTabKey(evt.shiftKey);
          specialHandled = true;
        }
        // Ctrl+Z (undo)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'z' && !evt.altKey) {
          this.fastIncorp(6);
          evt.preventDefault();
          if (evt.shiftKey) {
            this.doUndoRedo('redo');
          } else {
            this.doUndoRedo('undo');
          }
          specialHandled = true;
        }
        // Ctrl+Y (redo)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'y') {
          this.fastIncorp(10);
          evt.preventDefault();
          this.doUndoRedo('redo');
          specialHandled = true;
        }
        // Ctrl+B (bold)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'b') {
          this.fastIncorp(13);
          evt.preventDefault();
          this.toggleAttributeOnSelection('bold');
          specialHandled = true;
        }
        // Ctrl+I (italic)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'i') {
          this.fastIncorp(14);
          evt.preventDefault();
          this.toggleAttributeOnSelection('italic');
          specialHandled = true;
        }
        // Ctrl+U (underline)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'u') {
          this.fastIncorp(15);
          evt.preventDefault();
          this.toggleAttributeOnSelection('underline');
          specialHandled = true;
        }
        // Ctrl+5 (strikethrough)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === '5' &&
            evt.altKey !== true) {
          this.fastIncorp(13);
          evt.preventDefault();
          this.toggleAttributeOnSelection('strikethrough');
          specialHandled = true;
        }
        // Ctrl+Shift+L (unordered list)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) &&
            String.fromCharCode(which).toLowerCase() === 'l' &&
            evt.shiftKey) {
          this.fastIncorp(9);
          evt.preventDefault();
          this.doInsertUnorderedList();
          specialHandled = true;
        }
        // Ctrl+Shift+N or Ctrl+Shift+1 (ordered list)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) && evt.shiftKey &&
            (String.fromCharCode(which).toLowerCase() === 'n' ||
             String.fromCharCode(which) === '1')) {
          this.fastIncorp(9);
          evt.preventDefault();
          this.doInsertOrderedList();
          specialHandled = true;
        }
        // Ctrl+Shift+C (clear authorship)
        if (!specialHandled && isTypeForCmdKey &&
            (evt.metaKey || evt.ctrlKey) && evt.shiftKey &&
            String.fromCharCode(which).toLowerCase() === 'c') {
          this.fastIncorp(9);
          evt.preventDefault();
          this.execCommand('clearauthorship');
          specialHandled = true;
        }
        // Ctrl+H (backspace)
        if (!specialHandled && isTypeForCmdKey &&
            evt.ctrlKey &&
            String.fromCharCode(which).toLowerCase() === 'h') {
          this.fastIncorp(20);
          evt.preventDefault();
          this.doDeleteKey();
          specialHandled = true;
        }
      }

      if (type === 'keydown') {
        this.idleWorkTimer.atLeast(500);
      } else if (type === 'keypress') {
        if (!specialHandled) {
          this.idleWorkTimer.atMost(0);
        } else {
          this.idleWorkTimer.atLeast(500);
        }
      } else if (type === 'keyup') {
        this.idleWorkTimer.atLeast(0);
        this.idleWorkTimer.atMost(0);
      }

      const isFirefoxHalfCharacter =
        browser.firefox && evt.altKey && charCode === 0 && keyCode === 0;
      const isSafariHalfCharacter =
        browser.safari && evt.altKey && keyCode === 229;

      if (this.thisKeyDoesntTriggerNormalize || isFirefoxHalfCharacter ||
          isSafariHalfCharacter) {
        this.idleWorkTimer.atLeast(3000);
        this.thisKeyDoesntTriggerNormalize = true;
      }

      if (!specialHandled && !this.thisKeyDoesntTriggerNormalize &&
          !this.inInternationalComposition && type !== 'keyup') {
        this.observeChangesAroundSelection();
      }

      if (type === 'keyup') {
        this.thisKeyDoesntTriggerNormalize = false;
      }
    });
  }

  private doReturnKey(): void {
    if (!(this.rep.selStart && this.rep.selEnd)) return;

    const lineNum = this.rep.selStart[0];
    let listType = this.getLineListType(lineNum);

    if (listType) {
      const text = (this.rep.lines.atIndex(lineNum) as any).text;
      const listTypeParsed = /([a-z]+)([0-9]+)/.exec(listType);
      if (!listTypeParsed) return;
      const type = listTypeParsed[1];
      const level = Number(listTypeParsed[2]);

      if (text === '*' && type !== 'indent') {
        if (level > 1) {
          this._setLineListType(lineNum, type + (level - 1));
        } else {
          this._setLineListType(lineNum, '');
          this.renumberList(lineNum + 1);
        }
      } else if (lineNum + 1 <= this.rep.lines.length()) {
        this.performDocumentReplaceSelection('\n');
        this._setLineListType(lineNum + 1, type + level);
      }
    } else {
      this.performDocumentReplaceSelection('\n');
      this.handleReturnIndentation();
    }
  }

  private handleReturnIndentation(): void {
    if (this.isCaret() && this.getCaretColumn() === 0 && this.getCaretLine() > 0) {
      const lineNum = this.getCaretLine();
      const thisLine = this.rep.lines.atIndex(lineNum)!;
      const prevLine: any = this.rep.lines.prev(thisLine);
      if (!prevLine) return;
      const prevLineText = prevLine.text;
      let theIndent = /^ *(?:)/.exec(prevLineText)![0];
      if (/[[(:{]\s*$/.exec(prevLineText)) {
        theIndent += AceEditor.THE_TAB;
      }
      const cs = new Builder(this.rep.lines.totalWidth()).keep(
        this.rep.lines.offsetOfIndex(lineNum), lineNum).insert(
        theIndent, [
          ['author', this.thisAuthor],
        ], this.rep.apool).toString();
      this.performDocumentApplyChangeset(cs);
      this.performSelectionChange([lineNum, theIndent.length], [lineNum, theIndent.length]);
    }
  }

  private doDeleteKey(optEvt?: any): void {
    const evt = optEvt || {};
    let handled = false;
    if (this.rep.selStart) {
      if (this.isCaret()) {
        const lineNum = this.getCaretLine();
        const col = this.getCaretColumn();
        const lineEntry: any = this.rep.lines.atIndex(lineNum);
        const lineText = lineEntry.text;
        const lineMarker = lineEntry.lineMarker;
        if (evt.metaKey && col > lineMarker) {
          this.performDocumentReplaceRange([lineNum, lineMarker], [lineNum, col], '');
          handled = true;
        } else if (/^ +$/.exec(lineText.substring(lineMarker, col))) {
          const col2 = col - lineMarker;
          const tabSize = AceEditor.THE_TAB.length;
          const toDelete = ((col2 - 1) % tabSize) + 1;
          this.performDocumentReplaceRange([lineNum, col - toDelete], [lineNum, col], '');
          handled = true;
        }
      }
      if (!handled) {
        if (this.isCaret()) {
          const theLine = this.getCaretLine();
          const lineEntry: any = this.rep.lines.atIndex(theLine);
          if (this.getCaretColumn() <= lineEntry.lineMarker) {
            const prevLineListType = theLine > 0 ? this.getLineListType(theLine - 1) : '';
            const thisLineListType = this.getLineListType(theLine);
            const prevLineEntry: any = theLine > 0 && this.rep.lines.atIndex(theLine - 1);
            const prevLineBlank = prevLineEntry &&
              prevLineEntry.text.length === prevLineEntry.lineMarker;
            const thisLineHasMarker = this.documentAttributeManager.lineHasMarker(theLine);

            if (thisLineListType) {
              if (prevLineBlank && !prevLineListType) {
                this.performDocumentReplaceRange(
                  [theLine - 1, prevLineEntry.text.length], [theLine, 0], '');
              } else {
                this.performDocumentReplaceRange(
                  [theLine, 0], [theLine, lineEntry.lineMarker], '');
              }
            } else if (thisLineHasMarker && prevLineEntry) {
              this.performDocumentReplaceRange(
                [theLine - 1, prevLineEntry.text.length],
                [theLine, lineEntry.lineMarker], '');
            } else if (theLine > 0) {
              this.performDocumentReplaceRange(
                [theLine - 1, prevLineEntry.text.length], [theLine, 0], '');
            }
          } else {
            const docChar = this.caretDocChar();
            if (docChar > 0) {
              if (evt.metaKey || evt.ctrlKey || evt.altKey) {
                let deleteBackTo = docChar - 1;
                while (deleteBackTo > lineEntry.lineMarker &&
                       this.isWordChar(this.rep.alltext.charAt(deleteBackTo - 1))) {
                  deleteBackTo--;
                }
                this.performDocumentReplaceCharRange(deleteBackTo, docChar, '');
              } else {
                this.performDocumentReplaceCharRange(docChar - 1, docChar, '');
              }
            }
          }
        } else {
          this.performDocumentReplaceSelection('');
        }
      }
    }

    const line = this.getCaretLine();
    if (line !== -1 && this.renumberList(line + 1) == null) {
      this.renumberList(line);
    }
  }

  private doTabKey(shiftDown: boolean): void {
    if (!this.doIndentOutdent(shiftDown)) {
      this.performDocumentReplaceSelection(AceEditor.THE_TAB);
    }
  }

  private doIndentOutdent(isOut: boolean): boolean {
    if (!((this.rep.selStart && this.rep.selEnd) ||
          (this.rep.selStart[0] === this.rep.selEnd[0] &&
           this.rep.selStart[1] === this.rep.selEnd[1] &&
           this.rep.selEnd[1] > 1)) &&
        isOut !== true) {
      return false;
    }

    const firstLine = this.rep.selStart[0];
    const lastLine = Math.max(
      firstLine, this.rep.selEnd[0] - (this.rep.selEnd[1] === 0 ? 1 : 0));
    const mods: [number, string][] = [];
    for (let n = firstLine; n <= lastLine; n++) {
      let listType = this.getLineListType(n);
      let t = 'indent';
      let level = 0;
      if (listType) {
        const parsed = /([a-z]+)([0-9]+)/.exec(listType);
        if (parsed) {
          t = parsed[1];
          level = Number(parsed[2]);
        }
      }
      const newLevel = Math.max(0, Math.min(AceEditor.MAX_LIST_LEVEL, level + (isOut ? -1 : 1)));
      if (level !== newLevel) {
        mods.push([n, newLevel > 0 ? t + newLevel : '']);
      }
    }

    for (const mod of mods) this._setLineListType(mod[0], mod[1]);
    return true;
  }

  private handleClick(evt: MouseEvent): void {
    this.inCallStackIfNecessary('handleClick', () => {
      this.idleWorkTimer.atMost(200);
    });

    const isLink = (n: any) => (n.tagName || '').toLowerCase() === 'a' && n.href;

    if (evt.button !== 2 && evt.button !== 3) {
      let n: any = evt.target;
      while (n && n.parentNode && !isLink(n)) {
        n = n.parentNode;
      }
      if (n && isLink(n)) {
        try {
          window.open(n.href, '_blank', 'noopener,noreferrer');
          if (evt.ctrlKey) window.focus();
        } catch (e) {
          // absorb error
        }
        evt.preventDefault();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private - Undo / Redo
  // -----------------------------------------------------------------------

  private doUndoRedo(which: 'undo' | 'redo'): void {
    if (undoModule.enabled) {
      let whichMethod: string | undefined;
      if (which === 'undo') whichMethod = 'performUndo';
      if (which === 'redo') whichMethod = 'performRedo';
      if (whichMethod) {
        const oldEventType = this.currentCallStack.editEvent.eventType;
        this.currentCallStack.startNewEvent(which);
        (undoModule as any)[whichMethod]((backset: string, selectionInfo: any) => {
          if (backset) {
            this.performDocumentApplyChangeset(backset);
          }
          if (selectionInfo) {
            this.performSelectionChange(
              this.lineAndColumnFromChar(selectionInfo.selStart),
              this.lineAndColumnFromChar(selectionInfo.selEnd),
              selectionInfo.selFocusAtStart);
          }
          const oldEvent = this.currentCallStack.startNewEvent(oldEventType, true);
          return oldEvent;
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private - Formatting
  // -----------------------------------------------------------------------

  private setAttributeOnSelection(attributeName: string, attributeValue: string): void {
    if (!(this.rep.selStart && this.rep.selEnd)) return;
    this.documentAttributeManager.setAttributesOnRange(this.rep.selStart, this.rep.selEnd, [
      [attributeName, attributeValue],
    ]);
  }

  private getAttributeOnSelection(attributeName: string, prevChar?: boolean): boolean {
    if (!(this.rep.selStart && this.rep.selEnd)) return false;
    const isNotSelection = (
      this.rep.selStart[0] === this.rep.selEnd[0] &&
      this.rep.selEnd[1] === this.rep.selStart[1]
    );
    if (isNotSelection) {
      if (prevChar) {
        if (this.rep.selStart[1] !== 0) {
          this.rep.selStart[1]--;
        }
      }
    }

    const withIt = new AttributeMap(this.rep.apool).set(attributeName, 'true').toString();
    const withItRegex = new RegExp(`${withIt.replace(/\*/g, '\\*')}(\\*|$)`);
    const hasIt = (attribs: string) => withItRegex.test(attribs);

    const rangeHasAttrib = (selStart: any, selEnd: any): boolean => {
      if (selStart[1] === selEnd[1] && selStart[0] === selEnd[0]) return false;

      if (selStart[0] !== selEnd[0]) {
        let hasAttrib = true;
        hasAttrib = hasAttrib && rangeHasAttrib(
          selStart, [selStart[0], (this.rep.lines.atIndex(selStart[0]) as any).text.length]);
        for (let n = selStart[0] + 1; n < selEnd[0]; n++) {
          hasAttrib = hasAttrib &&
            rangeHasAttrib([n, 0], [n, (this.rep.lines.atIndex(n) as any).text.length]);
        }
        hasAttrib = hasAttrib && rangeHasAttrib([selEnd[0], 0], [selEnd[0], selEnd[1]]);
        return hasAttrib;
      }

      const lineNum = selStart[0];
      const start = selStart[1];
      const end = selEnd[1];
      let hasAttrib = true;
      let indexIntoLine = 0;
      for (const op of deserializeOps(this.rep.alines[lineNum])) {
        const opStartInLine = indexIntoLine;
        const opEndInLine = opStartInLine + op.chars;
        if (!hasIt(op.attribs)) {
          if (!(opEndInLine <= start || opStartInLine >= end)) {
            hasAttrib = false;
            break;
          }
        }
        indexIntoLine = opEndInLine;
      }
      return hasAttrib;
    };
    return rangeHasAttrib(this.rep.selStart, this.rep.selEnd);
  }

  private toggleAttributeOnSelection(attributeName: string): void {
    if (!(this.rep.selStart && this.rep.selEnd)) return;

    let selectionAllHasIt = true;
    const withIt = new AttributeMap(this.rep.apool).set(attributeName, 'true').toString();
    const withItRegex = new RegExp(`${withIt.replace(/\*/g, '\\*')}(\\*|$)`);
    const hasIt = (attribs: string) => withItRegex.test(attribs);

    const selStartLine = this.rep.selStart[0];
    const selEndLine = this.rep.selEnd[0];
    for (let n = selStartLine; n <= selEndLine; n++) {
      let indexIntoLine = 0;
      let selectionStartInLine = 0;
      if (this.documentAttributeManager.lineHasMarker(n)) {
        selectionStartInLine = 1;
      }
      let selectionEndInLine = (this.rep.lines.atIndex(n) as any).text.length;
      if (n === selStartLine) {
        selectionStartInLine = this.rep.selStart[1];
      }
      if (n === selEndLine) {
        selectionEndInLine = this.rep.selEnd[1];
      }
      for (const op of deserializeOps(this.rep.alines[n])) {
        const opStartInLine = indexIntoLine;
        const opEndInLine = opStartInLine + op.chars;
        if (!hasIt(op.attribs)) {
          if (!(opEndInLine <= selectionStartInLine || opStartInLine >= selectionEndInLine)) {
            selectionAllHasIt = false;
            break;
          }
        }
        indexIntoLine = opEndInLine;
      }
      if (!selectionAllHasIt) break;
    }

    const attributeValue = selectionAllHasIt ? '' : 'true';
    this.documentAttributeManager.setAttributesOnRange(
      this.rep.selStart, this.rep.selEnd, [[attributeName, attributeValue]]);
  }

  // -----------------------------------------------------------------------
  // Private - List Operations
  // -----------------------------------------------------------------------

  private listAttributeName = 'list';

  private getLineListType(lineNum: number): string {
    return this.documentAttributeManager.getAttributeOnLine(lineNum, this.listAttributeName);
  }

  private _setLineListType(lineNum: number, listType: string): void {
    if (listType === '') {
      this.documentAttributeManager.removeAttributeOnLine(lineNum, this.listAttributeName);
      this.documentAttributeManager.removeAttributeOnLine(lineNum, 'start');
    } else {
      this.documentAttributeManager.setAttributeOnLine(
        lineNum, this.listAttributeName, listType);
    }

    if (this.renumberList(lineNum + 1) == null) {
      this.renumberList(lineNum);
    }
  }

  private renumberList(lineNum: number): number | null {
    let type = this.getLineListType(lineNum);
    if (!type) return null;
    const parsed = /([a-z]+)[0-9]+/.exec(type);
    if (!parsed) return null;
    if (parsed[1] === 'indent') return null;

    while (lineNum - 1 >= 0 && (type = this.getLineListType(lineNum - 1))) {
      const p = /([a-z]+)[0-9]+/.exec(type);
      if (!p || p[1] === 'indent') break;
      lineNum--;
    }

    const builder = new Builder(this.rep.lines.totalWidth());
    let loc: [number, number] = [0, 0];
    const applyNumberList = (line: number, level: number): number => {
      let position = 1;
      let curLevel = level;
      let lt: string;
      while ((lt = this.getLineListType(line))) {
        const ltParsed = /([a-z]+)([0-9]+)/.exec(lt);
        if (!ltParsed) return line;
        curLevel = Number(ltParsed[2]);
        if (isNaN(curLevel) || ltParsed[0] === 'indent') {
          return line;
        } else if (curLevel === level) {
          buildKeepRange(this.rep as any, builder, loc, (loc = [line, 0]));
          buildKeepRange(this.rep as any, builder, loc, (loc = [line, 1]), [
            ['start', position],
          ] as any, this.rep.apool);
          position++;
          line++;
        } else if (curLevel < level) {
          return line;
        } else {
          line = applyNumberList(line, level + 1);
        }
      }
      return line;
    };

    applyNumberList(lineNum, 1);
    const cs = builder.toString();
    if (!isIdentity(cs)) {
      this.performDocumentApplyChangeset(cs);
    }
    return lineNum;
  }

  private doInsertList(type: string): void {
    if (!(this.rep.selStart && this.rep.selEnd)) return;

    const firstLine = this.rep.selStart[0];
    const lastLine = Math.max(
      firstLine, this.rep.selEnd[0] - (this.rep.selEnd[1] === 0 ? 1 : 0));

    let allLinesAreList = true;
    for (let n = firstLine; n <= lastLine; n++) {
      const lt = this.getLineListType(n);
      if (!lt || lt.slice(0, type.length) !== type) {
        allLinesAreList = false;
        break;
      }
    }

    const mods: [number, string][] = [];
    for (let n = firstLine; n <= lastLine; n++) {
      let level = 0;
      let togglingOn = true;
      const t = this.getLineListType(n);
      const listTypeParsed = /([a-z]+)([0-9]+)/.exec(t);

      if (allLinesAreList) {
        togglingOn = false;
      }

      if (listTypeParsed) {
        level = Number(listTypeParsed[2]);
      }

      if (togglingOn) {
        mods.push([n, allLinesAreList
          ? `indent${level}`
          : (t ? type + level : `${type}1`)]);
      } else {
        // Scrap the entire indentation and list type.
        if (level === 1) {
          mods.push([n, '']);
        } else if (level > 1) {
          mods.push([n, '']);
          mods.push([n, `indent${level}`]);
        }
      }
    }

    for (const mod of mods) this._setLineListType(mod[0], mod[1]);
  }

  private doInsertUnorderedList(): void {
    this.doInsertList('bullet');
  }

  private doInsertOrderedList(): void {
    this.doInsertList('number');
  }

  // -----------------------------------------------------------------------
  // Private - Helper Functions
  // -----------------------------------------------------------------------

  private caretDocChar(): number {
    return this.rep.lines.offsetOfIndex(this.getCaretLine()) + this.getCaretColumn();
  }

  private isWordChar(c: string): boolean {
    return /[\w]/.test(c);
  }

  private textify(str: string): string {
    return str.replace(/[\n\r ]/g, ' ').replace(/\xa0/g, ' ').replace(/\t/g, '        ');
  }

  /* @internal */ isBlockElement(n: Node): boolean {
    return !!AceEditor._blockElems[((n as Element).tagName || '').toLowerCase()];
  }

  private isStyleAttribute(aname: string): boolean {
    return !!AceEditor.STYLE_ATTRIBS[aname];
  }

  private isDefaultLineAttribute(aname: string): boolean {
    return AttributeManager.DEFAULT_LINE_ATTRIBUTES.indexOf(aname) !== -1;
  }

  private isPadLoading(t: string): boolean {
    return t === 'setup' || t === 'setBaseText' || t === 'importText';
  }

  private enforceEditability(): void {
    this.setEditable(this.isEditable);
  }

  // -----------------------------------------------------------------------
  // Private - Event Binding
  // -----------------------------------------------------------------------

  private bindTheEventHandlers(): void {
    // Key events
    this.targetBody.addEventListener('keydown', (e) => this.handleKeyEvent(e));
    this.targetBody.addEventListener('keypress', (e) => this.handleKeyEvent(e));
    this.targetBody.addEventListener('keyup', (e) => this.handleKeyEvent(e));

    // Click events
    this.targetBody.addEventListener('click', (e) => this.handleClick(e));
    this.targetBody.addEventListener('mouseup', () => {
      this.inCallStackIfNecessary('handleClick', () => {
        this.idleWorkTimer.atMost(200);
      });
    });

    // Input event - schedule incorporateUserChanges
    this.targetBody.addEventListener('input', () => {
      this.idleWorkTimer.atMost(0);
    });

    // Paste event
    this.targetBody.addEventListener('paste', (e) => {
      editorBus.emit('custom:ace:paste', {
        rep: this.rep,
        documentAttributeManager: this.documentAttributeManager,
        e,
      });
      this.idleWorkTimer.atMost(0);
    });

    // Cut event
    this.targetBody.addEventListener('cut', () => {
      this.idleWorkTimer.atMost(0);
    });

    // Drop event
    this.targetBody.addEventListener('drop', (e) => {
      const isLinkTarget = (target: EventTarget | null) =>
        target instanceof Element &&
        (target.localName === 'a' || target.closest('a') != null);
      if (isLinkTarget(e.target)) {
        e.preventDefault();
      }

      // Mark origin with <style> to make content be observed by incorporateUserChanges
      const selection = this.getSelection();
      if (selection) {
        const firstLineSelected = this.topLevel(selection.startPoint.node);
        const lastLineSelected = this.topLevel(selection.endPoint.node);
        if (firstLineSelected && lastLineSelected) {
          const lineBeforeSelection = firstLineSelected.previousSibling;
          const lineAfterSelection = lastLineSelected.nextSibling;
          const neighbor = lineBeforeSelection || lineAfterSelection;
          if (neighbor) {
            (neighbor as Element).appendChild(this.targetDoc.createElement('style'));
          }
        }
      }

      this.idleWorkTimer.atMost(0);
    });

    // Composition events
    this.targetBody.addEventListener('compositionstart', () => {
      if (this.inInternationalComposition) return;
      this.inInternationalComposition = new Promise<void>((resolve) => {
        this.targetBody.addEventListener('compositionend', () => {
          this.inInternationalComposition = null;
          resolve();
          // After composition ends, incorporate changes
          this.idleWorkTimer.atMost(0);
        }, {once: true});
      });
    });
  }
}
