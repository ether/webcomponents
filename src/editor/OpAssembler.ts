import Op from "./Op.js";
import {assert} from './Changeset.js'

export class OpAssembler {
  private serialized: string;
  constructor() {
    this.serialized = ''
  }
  append = (op: Op) => {
    assert(op instanceof Op, 'argument must be an instance of Op');
    this.serialized += op.toString();
  }
  toString = () => this.serialized
  clear = () => {
    this.serialized = '';
  }
}
