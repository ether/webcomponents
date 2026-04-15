import Op from "./Op.js";
import {clearOp, copyOp, deserializeOps} from "./Changeset.js";

export class OpIter {
  private gen
  private _next: IteratorResult<Op, void>

  constructor(ops: string) {
    this.gen = deserializeOps(ops);
    this._next = this.gen.next();
  }

  hasNext(): boolean {
    return !this._next.done;
  }

  next(opOut: Op = new Op()): Op {
    if (this.hasNext()) {
      copyOp(this._next.value!, opOut);
      this._next = this.gen.next();
    } else {
      clearOp(opOut);
    }
    return opOut;
  }
}
