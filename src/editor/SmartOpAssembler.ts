import {MergingOpAssembler} from "./MergingOpAssembler.js";
import {StringAssembler} from "./StringAssembler.js";
import Op from "./Op.js";
import {Attribute} from "./types/Attribute.js";
import AttributePool from "./AttributePool.js";
import {opsFromText} from "./Changeset.js";

export class SmartOpAssembler {
  private minusAssem: MergingOpAssembler;
  private plusAssem: MergingOpAssembler;
  private keepAssem: MergingOpAssembler;
  private lastOpcode: string;
  private lengthChange: number;
  private assem: StringAssembler;

  constructor() {
    this.minusAssem = new MergingOpAssembler()
    this.plusAssem = new MergingOpAssembler()
    this.keepAssem = new MergingOpAssembler()
    this.assem = new StringAssembler()
    this.lastOpcode = ''
    this.lengthChange = 0
  }

  flushKeeps = () => {
    this.assem.append(this.keepAssem.toString());
    this.keepAssem.clear();
  };

  flushPlusMinus = () => {
    this.assem.append(this.minusAssem.toString());
    this.minusAssem.clear();
    this.assem.append(this.plusAssem.toString());
    this.plusAssem.clear();
  };

  append = (op: Op) => {
    if (!op.opcode) return;
    if (!op.chars) return;

    if (op.opcode === '-') {
      if (this.lastOpcode === '=') {
        this.flushKeeps();
      }
      this.minusAssem.append(op);
      this.lengthChange -= op.chars;
    } else if (op.opcode === '+') {
      if (this.lastOpcode === '=') {
        this.flushKeeps();
      }
      this.plusAssem.append(op);
      this.lengthChange += op.chars;
    } else if (op.opcode === '=') {
      if (this.lastOpcode !== '=') {
        this.flushPlusMinus();
      }
      this.keepAssem.append(op);
    }
    this.lastOpcode = op.opcode;
  };

  appendOpWithText = (opcode: '-'|'+'|'=', text: string, attribs: Attribute[]|string, pool?: AttributePool) => {
    for (const op of opsFromText(opcode, text, attribs, pool)) this.append(op);
  };

  toString = () => {
    this.flushPlusMinus();
    this.flushKeeps();
    return this.assem.toString();
  };

  clear = () => {
    this.minusAssem.clear();
    this.plusAssem.clear();
    this.keepAssem.clear();
    this.assem.clear();
    this.lengthChange = 0;
  };

  endDocument = () => {
    this.keepAssem.endDocument();
  };

  getLengthChange = () => this.lengthChange;
}
