import {OpAssembler} from "./OpAssembler.js";
import Op from "./Op.js";
import {clearOp, copyOp} from "./Changeset.js";

export class MergingOpAssembler {
  private assem: OpAssembler;
  private readonly bufOp: Op;
  private bufOpAdditionalCharsAfterNewline: number;

  constructor() {
    this.assem = new OpAssembler()
    this.bufOp = new Op()
    this.bufOpAdditionalCharsAfterNewline = 0;
  }

  flush = (isEndDocument?: boolean) => {
    if (!this.bufOp.opcode) return;
    if (isEndDocument && this.bufOp.opcode === '=' && !this.bufOp.attribs) {
      // final merged keep, leave it implicit
    } else {
      this.assem.append(this.bufOp);
      if (this.bufOpAdditionalCharsAfterNewline) {
        this.bufOp.chars = this.bufOpAdditionalCharsAfterNewline;
        this.bufOp.lines = 0;
        this.assem.append(this.bufOp);
        this.bufOpAdditionalCharsAfterNewline = 0;
      }
    }
    this.bufOp.opcode = '';
  }

  append = (op: Op) => {
    if (op.chars <= 0) return;
    if (this.bufOp.opcode === op.opcode && this.bufOp.attribs === op.attribs) {
      if (op.lines > 0) {
        this.bufOp.chars += this.bufOpAdditionalCharsAfterNewline + op.chars;
        this.bufOp.lines += op.lines;
        this.bufOpAdditionalCharsAfterNewline = 0;
      } else if (this.bufOp.lines === 0) {
        this.bufOp.chars += op.chars;
      } else {
        this.bufOpAdditionalCharsAfterNewline += op.chars;
      }
    } else {
      this.flush();
      copyOp(op, this.bufOp);
    }
  }

  endDocument = () => {
    this.flush(true);
  };

  toString = () => {
    this.flush();
    return this.assem.toString();
  };

  clear = () => {
    this.assem.clear();
    clearOp(this.bufOp);
  };
}
