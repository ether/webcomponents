import {splitTextLines} from "./Changeset.js";

/**
 * A splice-style array where the first element is the start index,
 * the second element is the delete count, and remaining elements are
 * string items to insert.
 */
type SpliceArray = [number, number, ...string[]];

interface LinesInterface {
  get(i: number): string;
  length(): number;
  splice(...args: unknown[]): void;
  slice?(start?: number, end?: number): string[];
}

type Lines = string[] | LinesInterface;

class TextLinesMutator {
  private _lines: Lines;
  private _curSplice: SpliceArray;
  private _inSplice: boolean;
  private _curLine: number;
  private _curCol: number;

  constructor(lines: Lines) {
    this._lines = lines;
    this._curSplice = [0, 0];
    this._inSplice = false;
    this._curLine = 0;
    this._curCol = 0;
  }

  _linesGet(idx: number): string {
    if ('get' in this._lines) {
      return (this._lines as LinesInterface).get(idx);
    } else {
      return (this._lines as string[])[idx];
    }
  }

  _linesSlice(start: number | undefined, end: number | undefined): string[] {
    if ('slice' in this._lines && typeof this._lines.slice === 'function') {
      return this._lines.slice(start, end) as string[];
    } else {
      return [];
    }
  }

  _linesLength(): number {
    if (Array.isArray(this._lines)) {
      return this._lines.length;
    } else {
      return (this._lines as LinesInterface).length();
    }
  }

  _enterSplice(): void {
    this._curSplice[0] = this._curLine;
    this._curSplice[1] = 0;
    if (this._curCol > 0) this._putCurLineInSplice();
    this._inSplice = true;
  }

  _leaveSplice(): void {
    if (Array.isArray(this._lines)) {
      this._lines.splice(this._curSplice[0], this._curSplice[1], ...this._curSplice.slice(2) as string[]);
    } else {
      (this._lines as LinesInterface).splice(...this._curSplice);
    }
    this._curSplice = [0, 0];
    this._inSplice = false;
  }

  _isCurLineInSplice(): boolean {
    return this._curLine - this._curSplice[0] < this._curSplice.length - 2;
  }

  _putCurLineInSplice(): number {
    if (!this._isCurLineInSplice()) {
      this._curSplice.push(this._linesGet(this._curSplice[0] + this._curSplice[1]));
      this._curSplice[1]++;
    }
    return 2 + this._curLine - this._curSplice[0];
  }

  skipLines(L: number, includeInSplice?: boolean): void {
    if (!L) return;
    if (includeInSplice) {
      if (!this._inSplice) this._enterSplice();
      for (let i = 0; i < L; i++) {
        this._curCol = 0;
        this._putCurLineInSplice();
        this._curLine++;
      }
    } else {
      if (this._inSplice) {
        if (L > 1) {
          this._leaveSplice();
        } else {
          this._putCurLineInSplice();
        }
      }
      this._curLine += L;
      this._curCol = 0;
    }
  }

  skip(N: number, L: number, includeInSplice?: boolean): void {
    if (!N) return;
    if (L) {
      this.skipLines(L, includeInSplice);
    } else {
      if (includeInSplice && !this._inSplice) this._enterSplice();
      if (this._inSplice) {
        this._putCurLineInSplice();
      }
      this._curCol += N;
    }
  }

  removeLines(L: number): string {
    if (!L) return '';
    if (!this._inSplice) this._enterSplice();

    const nextKLinesText = (k: number): string => {
      const m = this._curSplice[0] + this._curSplice[1];
      return this._linesSlice(m, m + k).join('');
    };

    let removed = '';
    if (this._isCurLineInSplice()) {
      if (this._curCol === 0) {
        removed = this._curSplice[this._curSplice.length - 1] as string;
        this._curSplice = [...this._curSplice.slice(0, -1)] as SpliceArray;
        removed += nextKLinesText(L - 1);
        this._curSplice[1] += L - 1;
      } else {
        removed = nextKLinesText(L - 1);
        this._curSplice[1] += L - 1;
        const sline = this._curSplice.length - 1;
        const slineVal = this._curSplice[sline] as string;
        removed = slineVal.substring(this._curCol) + removed;
        (this._curSplice as string[])[sline] = slineVal.substring(0, this._curCol) +
          this._linesGet(this._curSplice[0] + this._curSplice[1]);
        this._curSplice[1] += 1;
      }
    } else {
      removed = nextKLinesText(L);
      this._curSplice[1] += L;
    }
    return removed;
  }

  remove(N: number, L: number): string {
    if (!N) return '';
    if (L) return this.removeLines(L);
    if (!this._inSplice) this._enterSplice();
    const sline = this._putCurLineInSplice();
    const slineVal = this._curSplice[sline] as string;
    const removed = slineVal.substring(this._curCol, this._curCol + N);
    (this._curSplice as string[])[sline] = slineVal.substring(0, this._curCol) +
      slineVal.substring(this._curCol + N);
    return removed;
  }

  insert(text: string, L: number): void {
    if (!text) return;
    if (!this._inSplice) this._enterSplice();
    if (L) {
      const newLines = splitTextLines(text) || [];
      if (this._isCurLineInSplice()) {
        const sline = this._curSplice.length - 1;
        const theLine = this._curSplice[sline] as string;
        const lineCol = this._curCol;
        (this._curSplice as string[])[sline] = theLine.substring(0, lineCol) + newLines[0];
        this._curLine++;
        newLines.splice(0, 1);
        this._curSplice.push(...newLines);
        this._curLine += newLines.length;
        this._curSplice.push(theLine.substring(lineCol));
        this._curCol = 0;
      } else {
        this._curSplice.push(...newLines);
        this._curLine += newLines.length;
      }
    } else {
      const sline = this._putCurLineInSplice();
      const slineVal = this._curSplice[sline] as string;
      if (!slineVal) {
        console.error('curSplice[sline] not populated, actual curSplice contents is ' +
          `${JSON.stringify(this._curSplice)}`);
      }
      (this._curSplice as string[])[sline] = slineVal.substring(0, this._curCol) + text +
        slineVal.substring(this._curCol);
      this._curCol += text.length;
    }
  }

  hasMore(): boolean {
    let docLines = this._linesLength();
    if (this._inSplice) {
      docLines += this._curSplice.length - 2 - this._curSplice[1];
    }
    return this._curLine < docLines;
  }

  close(): void {
    if (this._inSplice) this._leaveSplice();
  }
}

export default TextLinesMutator
