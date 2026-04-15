import AttributeMap from './AttributeMap.js';
import {compose, deserializeOps, isIdentity} from './Changeset.js';
import {Builder} from "./Builder.js";
import {buildKeepRange, buildKeepToStartOfRange, buildRemoveRange} from './ChangesetUtils.js';
import attributes from './attributes.js';
import {Attribute} from './types/Attribute.js';

const lineMarkerAttribute = 'lmkr';

export default class AttributeManager {
  static DEFAULT_LINE_ATTRIBUTES = ['author', 'lmkr', 'insertorder', 'start'];
  static lineAttributes = [lineMarkerAttribute, 'list'];

  rep: any;
  applyChangesetCallback: ((cs: string) => void) | null;
  author: string;

  constructor(rep: any, applyChangesetCallback: ((cs: string) => void) | null) {
    this.rep = rep;
    this.applyChangesetCallback = applyChangesetCallback;
    this.author = '';
  }

  applyChangeset(changeset: Builder): Builder {
    if (!this.applyChangesetCallback) return changeset;
    const cs = changeset.toString();
    if (!isIdentity(cs)) {
      this.applyChangesetCallback(cs);
    }
    return changeset;
  }

  setAttributesOnRange(start: number[], end: number[], attribs: Attribute[]): string | Builder {
    if (start[0] < 0) throw new RangeError('selection start line number is negative');
    if (start[1] < 0) throw new RangeError('selection start column number is negative');
    if (end[0] < 0) throw new RangeError('selection end line number is negative');
    if (end[1] < 0) throw new RangeError('selection end column number is negative');
    if (start[0] > end[0] || (start[0] === end[0] && start[1] > end[1])) {
      throw new RangeError('selection ends before it starts');
    }
    let allChangesets: string | undefined;
    for (let row = start[0]; row <= end[0]; row++) {
      const [startCol, endCol] = this._findRowRange(row, start, end);
      const rowChangeset = this._setAttributesOnRangeByLine(row, startCol, endCol, attribs);
      if (allChangesets) {
        allChangesets = compose(allChangesets, rowChangeset.toString(), this.rep.apool);
      } else {
        allChangesets = rowChangeset.toString();
      }
    }
    // allChangesets is always set because the loop always executes at least once
    // (start[0] <= end[0] is guaranteed by the range check above).
    const finalBuilder = new Builder(this.rep.lines.totalWidth());
    if (!this.applyChangesetCallback) return finalBuilder;
    if (allChangesets && !isIdentity(allChangesets)) {
      this.applyChangesetCallback(allChangesets);
    }
    return finalBuilder;
  }

  _findRowRange(row: number, start: number[], end: number[]): [number, number] {
    if (row < start[0] || row > end[0]) throw new RangeError(`line ${row} not in selection`);
    if (row >= this.rep.lines.length()) throw new RangeError(`selected line ${row} does not exist`);
    const lineLength = this.rep.lines.offsetOfIndex(row + 1) - this.rep.lines.offsetOfIndex(row) - 1;
    const markerWidth = this.lineHasMarker(row) ? 1 : 0;
    if (lineLength - markerWidth < 0) throw new Error(`line ${row} has negative length`);
    if (start[1] < 0) throw new RangeError('selection starts at negative column');
    const startCol = Math.max(markerWidth, row === start[0] ? start[1] : 0);
    if (startCol > lineLength) throw new RangeError('selection starts after line end');
    if (end[1] < 0) throw new RangeError('selection ends at negative column');
    const endCol = Math.max(markerWidth, row === end[0] ? end[1] : lineLength);
    if (endCol > lineLength) throw new RangeError('selection ends after line end');
    if (startCol > endCol) throw new RangeError('selection ends before it starts');
    return [startCol, endCol];
  }

  _setAttributesOnRangeByLine(row: number, startCol: number, endCol: number, attribs: Attribute[]): Builder {
    const builder = new Builder(this.rep.lines.totalWidth());
    buildKeepToStartOfRange(this.rep, builder, [row, startCol]);
    buildKeepRange(this.rep, builder, [row, startCol], [row, endCol], attribs, this.rep.apool);
    return builder;
  }

  lineHasMarker(lineNum: number): boolean {
    return AttributeManager.lineAttributes.find(
        (attribute) => this.getAttributeOnLine(lineNum, attribute) !== '') !== undefined;
  }

  getAttributeOnLine(lineNum: number, attributeName: string): string {
    const aline = this.rep.alines[lineNum];
    if (!aline) return '';
    const [op] = deserializeOps(aline);
    if (op == null) return '';
    return AttributeMap.fromString(op.attribs, this.rep.apool).get(attributeName) || '';
  }

  getAttributesOnLine(lineNum: number): Attribute[] {
    const aline = this.rep.alines[lineNum];
    if (!aline) return [];
    const [op] = deserializeOps(aline);
    if (op == null) return [];
    return [...attributes.attribsFromString(op.attribs, this.rep.apool)];
  }

  getAttributeOnSelection(attributeName: string, prevChar?: boolean): boolean | undefined {
    const rep = this.rep;
    if (!(rep.selStart && rep.selEnd)) return;
    const isNotSelection = (rep.selStart[0] === rep.selEnd[0] && rep.selEnd[1] === rep.selStart[1]);
    if (isNotSelection) {
      if (prevChar) {
        if (rep.selStart[1] !== 0) rep.selStart[1]--;
      }
    }
    const withIt = new AttributeMap(rep.apool).set(attributeName, 'true').toString();
    const withItRegex = new RegExp(`${withIt.replace(/\*/g, '\\*')}(\\*|$)`);
    const hasIt = (attribs: string) => withItRegex.test(attribs);
    const rangeHasAttrib = (selStart: number[], selEnd: number[]): boolean => {
      if (selStart[1] === selEnd[1] && selStart[0] === selEnd[0]) return false;
      if (selStart[0] !== selEnd[0]) {
        let hasAttrib = rangeHasAttrib(selStart, [selStart[0], rep.lines.atIndex(selStart[0]).text.length]);
        for (let n = selStart[0] + 1; n < selEnd[0]; n++) {
          hasAttrib = hasAttrib && rangeHasAttrib([n, 0], [n, rep.lines.atIndex(n).text.length]);
        }
        hasAttrib = hasAttrib && rangeHasAttrib([selEnd[0], 0], [selEnd[0], selEnd[1]]);
        return hasAttrib;
      }
      const lineNum = selStart[0];
      const start = selStart[1];
      const end = selEnd[1];
      let hasAttrib = true;
      let indexIntoLine = 0;
      for (const op of deserializeOps(rep.alines[lineNum])) {
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
    return rangeHasAttrib(rep.selStart, rep.selEnd);
  }

  getAttributesOnPosition(lineNumber: number, column: number): Attribute[] {
    const aline = this.rep.alines[lineNumber];
    if (!aline) return [];
    let currentPointer = 0;
    for (const currentOperation of deserializeOps(aline)) {
      currentPointer += currentOperation.chars;
      if (currentPointer <= column) continue;
      return [...attributes.attribsFromString(currentOperation.attribs, this.rep.apool)];
    }
    return [];
  }

  getAttributesOnCaret(): Attribute[] {
    return this.getAttributesOnPosition(this.rep.selStart[0], this.rep.selStart[1]);
  }

  setAttributeOnLine(lineNum: number, attributeName: string, attributeValue: string): Builder {
    let loc: [number, number] = [0, 0];
    const builder = new Builder(this.rep.lines.totalWidth());
    const hasMarker = this.lineHasMarker(lineNum);
    buildKeepRange(this.rep, builder, loc, (loc = [lineNum, 0]));
    if (hasMarker) {
      buildKeepRange(this.rep, builder, loc, (loc = [lineNum, 1]), [
        [attributeName, attributeValue],
      ], this.rep.apool);
    } else {
      builder.insert('*', [
        ['author', this.author],
        ['insertorder', 'first'],
        [lineMarkerAttribute, '1'],
        [attributeName, attributeValue],
      ], this.rep.apool);
    }
    return this.applyChangeset(builder);
  }

  removeAttributeOnLine(lineNum: number, attributeName: string, attributeValue?: string): Builder | undefined {
    const builder = new Builder(this.rep.lines.totalWidth());
    const hasMarker = this.lineHasMarker(lineNum);
    let found = false;
    const attribs: Attribute[] = this.getAttributesOnLine(lineNum).map((attrib) => {
      if (attrib[0] === attributeName && (!attributeValue || attrib[0] === attributeValue)) {
        found = true;
        return [attrib[0], ''];
      } else if (attrib[0] === 'author') {
        return [attrib[0], this.author];
      }
      return attrib;
    });
    if (!found) return;
    buildKeepToStartOfRange(this.rep, builder, [lineNum, 0]);
    const countAttribsWithMarker = attribs
        .filter((a) => !!a[1]).map((a) => a[0])
        .filter((a) => !AttributeManager.DEFAULT_LINE_ATTRIBUTES.includes(a)).length;
    if (hasMarker && !countAttribsWithMarker) {
      buildRemoveRange(this.rep, builder, [lineNum, 0], [lineNum, 1]);
    } else {
      buildKeepRange(this.rep, builder, [lineNum, 0], [lineNum, 1], attribs, this.rep.apool);
    }
    return this.applyChangeset(builder);
  }

  toggleAttributeOnLine(lineNum: number, attributeName: string, attributeValue: string): Builder | undefined {
    return this.getAttributeOnLine(lineNum, attributeName)
      ? this.removeAttributeOnLine(lineNum, attributeName)
      : this.setAttributeOnLine(lineNum, attributeName, attributeValue);
  }

  hasAttributeOnSelectionOrCaretPosition(attributeName: string): boolean | undefined {
    const hasSelection = (
      (this.rep.selStart[0] !== this.rep.selEnd[0]) || (this.rep.selEnd[1] !== this.rep.selStart[1])
    );
    let hasAttrib: boolean | undefined;
    if (hasSelection) {
      hasAttrib = this.getAttributeOnSelection(attributeName);
    } else {
      const attributesOnCaretPosition = this.getAttributesOnCaret();
      const allAttribs: string[] = ([] as string[]).concat(...attributesOnCaretPosition);
      hasAttrib = allAttribs.includes(attributeName);
    }
    return hasAttrib;
  }
}
