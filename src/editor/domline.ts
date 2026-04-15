
// THIS FILE IS ALSO AN APPJET MODULE: etherpad.collab.ace.domline
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

// requires: top
// requires: plugins
// requires: undefined

import {escapeHtml, escapeHtmlAttribute} from './html_escape.js';
import {editorBus} from './core/EventBus.js';
import {lineAttributeMarker} from './linestylefilter.js';
const noop = (): void => {};
const identity = (value: string): string => value;

interface DomLineNode {
  innerHTML: string;
  className: string;
}

export interface DomLineResult {
  node: HTMLElement | DomLineNode;
  appendSpan: (txt: string, cls: string) => void;
  prepareForAdd: () => void;
  notifyAdded: () => void;
  clearSpans: () => void;
  finishUpdate: () => void;
  lineMarker: number;
}

export const domline = {
  addToLineClass(lineClass: string, cls: string): string {
    // an "empty span" at any point can be used to add classes to
    // the line, using line:className.  otherwise, we ignore
    // the span.
    cls.replace(/\S+/g, (c: string) => {
      if (c.indexOf('line:') === 0) {
        // add class to line
        lineClass = (lineClass ? `${lineClass} ` : '') + c.substring(5);
      }
      return c;
    });
    return lineClass;
  },

  // if "document" is falsy we don't create a DOM node, just
  // an object with innerHTML and className
  createDomLine(nonEmpty: boolean, doesWrap: boolean, optBrowser: unknown, optDocument?: Document): DomLineResult {
    const result: DomLineResult = {
      node: null as unknown as HTMLElement | DomLineNode,
      appendSpan: noop as (txt: string, cls: string) => void,
      prepareForAdd: noop,
      notifyAdded: noop,
      clearSpans: noop,
      finishUpdate: noop,
      lineMarker: 0,
    };

    const document = optDocument;

    if (document) {
      result.node = document.createElement('div');
      // JAWS and NVDA screen reader compatibility. Only needed if in a real browser.
      (result.node as HTMLElement).setAttribute('aria-live', 'assertive');
    } else {
      result.node = {
        innerHTML: '',
        className: '',
      };
    }

    let html: string[] = [];
    let preHtml = '';
    let postHtml = '';
    let curHTML: string | null = null;

    const processSpaces = (s: string): string => domline.processSpaces(s, doesWrap);
    const perTextNodeProcess = (doesWrap ? identity : processSpaces);
    const perHtmlLineProcess = (doesWrap ? processSpaces : identity);
    let lineClass = 'ace-line';

    result.appendSpan = (txt: string, cls: string): void => {
      let processedMarker = false;
      // Handle lineAttributeMarker, if present
      if (cls.indexOf(lineAttributeMarker) >= 0) {
        let listType: string | null = null;
        const listTypeMatch = /(?:^| )list:(\S+)/.exec(cls);
        const start = /(?:^| )start:(\S+)/.exec(cls);

        if (listTypeMatch) {
          listType = listTypeMatch[1];
          if (listType) {
            if (listType.indexOf('number') < 0) {
              preHtml += `<ul class="list-${escapeHtmlAttribute(listType)}"><li>`;
              postHtml = `</li></ul>${postHtml}`;
            } else {
              if (start) { // is it a start of a list with more than one item in?
                if (Number.parseInt(start[1]) === 1) { // if its the first one at this level?
                  // Add start class to DIV node
                  lineClass = `${lineClass} ` + `list-start-${listType}`;
                }
                preHtml +=
                  `<ol start=${start[1]} class="list-${escapeHtmlAttribute(listType)}"><li>`;
              } else {
                // Handles pasted contents into existing lists
                preHtml += `<ol class="list-${escapeHtmlAttribute(listType)}"><li>`;
              }
              postHtml += '</li></ol>';
            }
          }
          processedMarker = true;
        }
        // EventBus: emit editor:process:line:attribs with mutable result array
        const busProcessLineResult: Array<{preHtml?: string; postHtml?: string; processedMarker?: boolean}> = [];
        editorBus.emit('editor:process:line:attribs', {
          cls,
          domline,
          result: busProcessLineResult,
          modifier: {preHtml, postHtml, processedMarker},
        });
        for (const modifier of busProcessLineResult) {
          if (modifier.preHtml) preHtml += modifier.preHtml;
          if (modifier.postHtml) postHtml = modifier.postHtml + postHtml;
          if (modifier.processedMarker) processedMarker = true;
        }
        if (processedMarker) {
          result.lineMarker += txt.length;
          return; // don't append any text
        }
      }
      const extractedUrl: {href: string | null} = {href: null};
      const extractedTags: string[] = [];
      if (cls.indexOf('url') >= 0) {
        cls = cls.replace(/(^| )url:(\S+)/g, (_x0: string, space: string, url: string) => {
          extractedUrl.href = url;
          return `${space}url`;
        });
      }
      if (cls.indexOf('tag') >= 0) {
        cls = cls.replace(/(^| )tag:(\S+)/g, (_x0: string, space: string, tag: string) => {
          extractedTags.push(tag.toLowerCase());
          return space + tag;
        });
      }

      let extraOpenTags = '';
      let extraCloseTags = '';

      // EventBus: emit editor:create:dom:line with mutable result array
      const busCreateDomResult: Array<{cls?: string; extraOpenTags?: string; extraCloseTags?: string}> = [];
      editorBus.emit('editor:create:dom:line', {cls, domline, result: busCreateDomResult});
      for (const modifier of busCreateDomResult) {
        if (modifier.cls != null) cls = modifier.cls;
        if (modifier.extraOpenTags) extraOpenTags += modifier.extraOpenTags;
        if (modifier.extraCloseTags) extraCloseTags = modifier.extraCloseTags + extraCloseTags;
      }

      if ((!txt) && cls) {
        lineClass = domline.addToLineClass(lineClass, cls);
      } else if (txt) {
        if (extractedUrl.href) {
          let finalHref: string = extractedUrl.href;
          const urn_schemes = new RegExp('^(about|geo|mailto|tel):');
          // if the url doesn't include a protocol prefix, assume http
          if (!~finalHref.indexOf('://') && !urn_schemes.test(finalHref)) {
            finalHref = `http://${finalHref}`;
          }
          // Using rel="noreferrer" stops leaking the URL/location of the pad when
          // clicking links in the document.
          // Not all browsers understand this attribute, but it's part of the HTML5 standard.
          // https://html.spec.whatwg.org/multipage/links.html#link-type-noreferrer
          // Additionally, we do rel="noopener" to ensure a higher level of referrer security.
          // https://html.spec.whatwg.org/multipage/links.html#link-type-noopener
          // https://mathiasbynens.github.io/rel-noopener/
          // https://github.com/ether/etherpad-lite/pull/3636
          const escapedHref = escapeHtmlAttribute(finalHref);
          extraOpenTags = `${extraOpenTags}<a href="${escapedHref}" rel="noreferrer noopener">`;
          extraCloseTags = `</a>${extraCloseTags}`;
        }
        if (extractedTags.length > 0) {
          extractedTags.sort();
          extraOpenTags = `${extraOpenTags}<${extractedTags.join('><')}>`;
          extractedTags.reverse();
          extraCloseTags = `</${extractedTags.join('></')}>${extraCloseTags}`;
        }
        html.push(
            '<span class="', escapeHtmlAttribute(cls || ''),
            '">',
            extraOpenTags,
            perTextNodeProcess(escapeHtml(txt)),
            extraCloseTags,
            '</span>');
      }
    };
    result.clearSpans = (): void => {
      html = [];
      lineClass = 'ace-line';
      result.lineMarker = 0;
    };

    const writeHTML = (): void => {
      let newHTML = perHtmlLineProcess(html.join(''));
      if (!newHTML) {
        if ((!document) || (!optBrowser)) {
          newHTML += '&nbsp;';
        } else {
          newHTML += '<br/>';
        }
      }
      if (nonEmpty) {
        newHTML = (preHtml || '') + newHTML + (postHtml || '');
      }
      html = [];
      preHtml = '';
      postHtml = '';
      if (newHTML !== curHTML) {
        curHTML = newHTML;
        result.node.innerHTML = curHTML;
      }
      if (lineClass != null) result.node.className = lineClass;

    };
    result.prepareForAdd = writeHTML;
    result.finishUpdate = writeHTML;
    return result;
  },

  processSpaces(s: string, doesWrap: boolean): string {
    if (s.indexOf('<') < 0 && !doesWrap) {
      // short-cut
      return s.replace(/ /g, '&nbsp;');
    }
    const parts: string[] = [];
    s.replace(/<[^>]*>?| |[^ <]+/g, (m: string) => {
      parts.push(m);
      return m;
    });
    if (doesWrap) {
      let endOfLine = true;
      let beforeSpace = false;
      // last space in a run is normal, others are nbsp,
      // end of line is nbsp
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p === ' ') {
          if (endOfLine || beforeSpace) parts[i] = '&nbsp;';
          endOfLine = false;
          beforeSpace = true;
        } else if (p.charAt(0) !== '<') {
          endOfLine = false;
          beforeSpace = false;
        }
      }
      // beginning of line is nbsp
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === ' ') {
          parts[i] = '&nbsp;';
          break;
        } else if (p.charAt(0) !== '<') {
          break;
        }
      }
    } else {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === ' ') {
          parts[i] = '&nbsp;';
        }
      }
    }
    return parts.join('');
  },
};
