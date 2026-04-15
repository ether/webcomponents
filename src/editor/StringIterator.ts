import {assert} from "./Changeset.js";

export class StringIterator {
  private curIndex: number;
  private newLines: number;
  private str: string

  constructor(str: string) {
    this.curIndex = 0;
    this.str = str
    this.newLines = str.split('\n').length - 1;
  }
  remaining = () => this.str.length - this.curIndex;

  getnewLines = () => this.newLines;

  assertRemaining = (n: number) => {
    assert(n <= this.remaining(), `!(${n} <= ${this.remaining()})`);
  }

  take = (n: number) => {
    this.assertRemaining(n);
    const s = this.str.substring(this.curIndex, this.curIndex+n);
    this.newLines -= s.split('\n').length - 1;
    this.curIndex += n;
    return s;
  }

  peek = (n: number) => {
    this.assertRemaining(n);
    return this.str.substring(this.curIndex, this.curIndex+n);
  }

  skip = (n: number) => {
    this.assertRemaining(n);
    this.curIndex += n;
  }
}
