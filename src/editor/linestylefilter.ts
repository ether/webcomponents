
/**
 * This code is mostly from the old Etherpad. Please help us to comment this code.
 * This helps other people to understand this code better and helps them to improve it.
 * TL;DR COMMENTS ON THIS FILE ARE HIGHLY APPRECIATED
 */

// THIS FILE IS ALSO AN APPJET MODULE: etherpad.collab.ace.linestylefilter
// %APPJET%: import("etherpad.collab.ace.easysync2.Changeset");
// %APPJET%: import("etherpad.admin.plugins");
/**
 * Copyright 2009 Google Inc.
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

// requires: easysync2.Changeset
// requires: top
// requires: plugins
// requires: undefined

import {deserializeOps} from './Changeset.js';
import attributes from './attributes.js';
import {editorBus} from './core/EventBus.js';
import AttributeManager from './AttributeManager.js';
import Op from "./Op.js";
import type AttributePool from "./AttributePool.js";

export type TextAndClassFunc = (txt: string, cls: string) => void;

// Inlined URL regex from pad_utils (avoids importing the full pad_utils module)
const wordCharRegex = new RegExp(`[${[
  '\u0030-\u0039',
  '\u0041-\u005A',
  '\u0061-\u007A',
  '\u00C0-\u00D6',
  '\u00D8-\u00F6',
  '\u00F8-\u00FF',
  '\u0100-\u1FFF',
  '\u3040-\u9FFF',
  '\uF900-\uFDFF',
  '\uFE70-\uFEFE',
  '\uFF10-\uFF19',
  '\uFF21-\uFF3A',
  '\uFF41-\uFF5A',
  '\uFF66-\uFFDC',
].join('')}]`);

const urlRegex = (() => {
  const urlChar = `[-:@_.,~%+/?=&#!;()\\[\\]$'*${wordCharRegex.source.slice(1, -1)}]`;
  const postUrlPunct = '[:.,;?!)\\]\'*]';
  const withAuth = `(?:${[
    '(?:x-)?man',
    'afp',
    'file',
    'ftps?',
    'gopher',
    'https?',
    'nfs',
    'sftp',
    'smb',
    'txmt',
  ].join('|')})://`;
  const withoutAuth = `(?:${[
    'about',
    'geo',
    'mailto',
    'tel',
  ].join('|')}):`;
  return new RegExp(
    `(?:${withAuth}|${withoutAuth}|www\\.)${urlChar}*(?!${postUrlPunct})${urlChar}`, 'g');
})();

export const lineAttributeMarker = 'lineAttribMarker';

export const linestylefilter = {
  ATTRIB_CLASSES: {
    bold: 'tag:b',
    italic: 'tag:i',
    underline: 'tag:u',
    strikethrough: 'tag:s',
  } as Record<string, string>,

  getAuthorClassName(author: string): string {
    return `author-${author.replace(/[^a-y0-9]/g, (c) => {
      if (c === '.') return '-';
      return `z${c.charCodeAt(0)}z`;
    })}`;
  },

  // lineLength is without newline; aline includes newline,
  // but may be falsy if lineLength == 0
  getLineStyleFilter(lineLength: number, aline: string, textAndClassFunc: TextAndClassFunc, apool: AttributePool): TextAndClassFunc {
    if (lineLength === 0) return textAndClassFunc;

    const nextAfterAuthorColors = textAndClassFunc;

    const authorColorFunc = ((): TextAndClassFunc => {
      const lineEnd = lineLength;
      let curIndex = 0;
      let extraClasses: string | false;
      let leftInAuthor: number;

      const attribsToClasses = (attribs: string): string => {
        let classes = '';
        let isLineAttribMarker = false;

        for (const [key, value] of attributes.attribsFromString(attribs, apool)) {
          if (!key || !value) continue;
          if (!isLineAttribMarker && AttributeManager.lineAttributes.indexOf(key) >= 0) {
            isLineAttribMarker = true;
          }
          if (key === 'author') {
            classes += ` ${linestylefilter.getAuthorClassName(value)}`;
          } else if (key === 'list') {
            classes += ` list:${value}`;
          } else if (key === 'start') {
            // Needed to introduce the correct Ordered list item start number on import
            classes += ` start:${value}`;
          } else if (linestylefilter.ATTRIB_CLASSES[key]) {
            classes += ` ${linestylefilter.ATTRIB_CLASSES[key]}`;
          } else {
            // EventBus: emit editor:attribs:to:classes with mutable result array
            const busResult: string[] = [];
            editorBus.emit('editor:attribs:to:classes', {key, value, result: busResult});
            classes += ` ${busResult.join(' ')}`;
          }
        }

        if (isLineAttribMarker) classes += ` ${lineAttributeMarker}`;
        return classes.substring(1);
      };

      const attrOps = deserializeOps(aline);
      let attrOpsNext = attrOps.next();
      let nextOp: Op;
      let nextOpClasses: string | false;

      const goNextOp = (): void => {
        nextOp = attrOpsNext.done ? new Op() : attrOpsNext.value;
        if (!attrOpsNext.done) attrOpsNext = attrOps.next();
        nextOpClasses = (nextOp.opcode && attribsToClasses(nextOp.attribs));
      };
      goNextOp();

      const nextClasses = (): void => {
        if (curIndex < lineEnd) {
          extraClasses = nextOpClasses!;
          leftInAuthor = nextOp!.chars;
          goNextOp();
          while (nextOp!.opcode && nextOpClasses === extraClasses) {
            leftInAuthor += nextOp!.chars;
            goNextOp();
          }
        }
      };
      nextClasses();

      return (txt: string, cls: string): void => {
        const disableAuthors = false;
        while (txt.length > 0) {
          if (leftInAuthor! <= 0 || disableAuthors) {
            // prevent infinite loop if something funny's going on
            nextAfterAuthorColors(txt, cls);
            return;
          }
          let spanSize = txt.length;
          if (spanSize > leftInAuthor!) {
            spanSize = leftInAuthor!;
          }
          const curTxt = txt.substring(0, spanSize);
          txt = txt.substring(spanSize);
          nextAfterAuthorColors(curTxt, (cls && `${cls} `) + extraClasses);
          curIndex += spanSize;
          leftInAuthor! -= spanSize;
          if (leftInAuthor! === 0) {
            nextClasses();
          }
        }
      };
    })();
    return authorColorFunc;
  },

  getAtSignSplitterFilter(lineText: string, textAndClassFunc: TextAndClassFunc): TextAndClassFunc {
    const at = /@/g;
    at.lastIndex = 0;
    let splitPoints: number[] | null = null;
    let execResult: RegExpExecArray | null;
    while ((execResult = at.exec(lineText))) {
      if (!splitPoints) {
        splitPoints = [];
      }
      splitPoints.push(execResult.index);
    }

    if (!splitPoints) return textAndClassFunc;

    return linestylefilter.textAndClassFuncSplitter(textAndClassFunc, splitPoints);
  },

  getRegexpFilter(regExp: RegExp, tag: string): (lineText: string, textAndClassFunc: TextAndClassFunc) => TextAndClassFunc {
    return (lineText: string, textAndClassFunc: TextAndClassFunc): TextAndClassFunc => {
      regExp.lastIndex = 0;
      let regExpMatchs: Array<[number, string]> | null = null;
      let splitPoints: number[] | null = null;
      let execResult: RegExpExecArray | null;
      while ((execResult = regExp.exec(lineText))) {
        if (!regExpMatchs) {
          regExpMatchs = [];
          splitPoints = [];
        }
        const startIndex = execResult.index;
        const regExpMatch = execResult[0];
        regExpMatchs.push([startIndex, regExpMatch]);
        splitPoints!.push(startIndex, startIndex + regExpMatch.length);
      }

      if (!regExpMatchs) return textAndClassFunc;

      const regExpMatchForIndex = (idx: number): string | false => {
        for (let k = 0; k < regExpMatchs!.length; k++) {
          const u = regExpMatchs![k];
          if (idx >= u[0] && idx < u[0] + u[1].length) {
            return u[1];
          }
        }
        return false;
      };

      const handleRegExpMatchsAfterSplit = ((): TextAndClassFunc => {
        let curIndex = 0;
        return (txt: string, cls: string): void => {
          const txtlen = txt.length;
          let newCls = cls;
          const regExpMatch = regExpMatchForIndex(curIndex);
          if (regExpMatch) {
            newCls += ` ${tag}:${regExpMatch}`;
          }
          textAndClassFunc(txt, newCls);
          curIndex += txtlen;
        };
      })();

      return linestylefilter.textAndClassFuncSplitter(handleRegExpMatchsAfterSplit, splitPoints!);
    };
  },

  getURLFilter: null as unknown as (lineText: string, textAndClassFunc: TextAndClassFunc) => TextAndClassFunc,

  textAndClassFuncSplitter(func: TextAndClassFunc, splitPointsOpt: number[] | null): TextAndClassFunc {
    let nextPointIndex = 0;
    let idx = 0;

    // don't split at 0
    while (splitPointsOpt &&
        nextPointIndex < splitPointsOpt.length &&
        splitPointsOpt[nextPointIndex] === 0) {
      nextPointIndex++;
    }

    const spanHandler: TextAndClassFunc = (txt: string, cls: string): void => {
      if ((!splitPointsOpt) || nextPointIndex >= splitPointsOpt.length) {
        func(txt, cls);
        idx += txt.length;
      } else {
        const splitPoints = splitPointsOpt;
        const pointLocInSpan = splitPoints[nextPointIndex] - idx;
        const txtlen = txt.length;
        if (pointLocInSpan >= txtlen) {
          func(txt, cls);
          idx += txt.length;
          if (pointLocInSpan === txtlen) {
            nextPointIndex++;
          }
        } else {
          if (pointLocInSpan > 0) {
            func(txt.substring(0, pointLocInSpan), cls);
            idx += pointLocInSpan;
          }
          nextPointIndex++;
          // recurse
          spanHandler(txt.substring(pointLocInSpan), cls);
        }
      }
    };
    return spanHandler;
  },

  getFilterStack(lineText: string, textAndClassFunc: TextAndClassFunc, _abrowser?: unknown): TextAndClassFunc {
    const func = linestylefilter.getURLFilter(lineText, textAndClassFunc);

    return func;
  },

  // domLineObj is like that returned by domline.createDomLine
  populateDomLine(textLine: string, aline: string, apool: AttributePool, domLineObj: {appendSpan: (txt: string, cls: string) => void}): void {
    // remove final newline from text if any
    let text = textLine;
    if (text.slice(-1) === '\n') {
      text = text.substring(0, text.length - 1);
    }

    const textAndClassFunc: TextAndClassFunc = (tokenText: string, tokenClass: string): void => {
      domLineObj.appendSpan(tokenText, tokenClass);
    };

    let func = linestylefilter.getFilterStack(text, textAndClassFunc);
    func = linestylefilter.getLineStyleFilter(text.length, aline, func, apool);
    func(text, '');
  },
};

// Initialize getURLFilter after the object is created (self-referential)
linestylefilter.getURLFilter = linestylefilter.getRegexpFilter(urlRegex, 'url');
