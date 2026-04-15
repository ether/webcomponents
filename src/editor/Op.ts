import {numToString} from "./ChangesetUtils.js";

export type OpCode = ''|'='|'+'|'-';

export default class Op {
  opcode: ''|'='|'+'|'-'
  chars: number
  lines: number
  attribs: string

  constructor(opcode:''|'='|'+'|'-' = '') {
    this.opcode = opcode;
    this.chars = 0;
    this.lines = 0;
    this.attribs = '';
  }

  toString() {
    if (!this.opcode) throw new TypeError('null op');
    if (typeof this.attribs !== 'string') throw new TypeError('attribs must be a string');
    const l = this.lines ? `|${numToString(this.lines)}` : '';
    return this.attribs + l + this.opcode + numToString(this.chars);
  }
}
