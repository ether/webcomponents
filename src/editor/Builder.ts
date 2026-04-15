import {SmartOpAssembler} from "./SmartOpAssembler.js";
import Op from "./Op.js";
import {StringAssembler} from "./StringAssembler.js";
import AttributeMap from "./AttributeMap.js";
import {Attribute} from "./types/Attribute.js";
import AttributePool from "./AttributePool.js";
import {opsFromText, pack} from "./Changeset.js";

export class Builder {
  private readonly oldLen: number;
  private assem: SmartOpAssembler;
  private readonly o: Op;
  private charBank: StringAssembler;

  constructor(oldLen: number) {
    this.oldLen = oldLen
    this.assem = new SmartOpAssembler()
    this.o = new Op()
    this.charBank = new StringAssembler()
  }

  keep = (N: number, L?: number, attribs?: string|Attribute[], pool?: AttributePool): Builder => {
    this.o.opcode = '=';
    this.o.attribs = typeof attribs === 'string'
      ? attribs : new AttributeMap(pool).update(attribs || []).toString();
    this.o.chars = N;
    this.o.lines = (L || 0);
    this.assem.append(this.o);
    return this;
  }

  keepText = (text: string, attribs?: string|Attribute[], pool?: AttributePool): Builder => {
    for (const op of opsFromText('=', text, attribs, pool)) this.assem.append(op);
    return this;
  }

  insert = (text: string, attribs: string | Attribute[] | undefined, pool?: AttributePool | null | undefined): Builder => {
    for (const op of opsFromText('+', text, attribs, pool)) this.assem.append(op);
    this.charBank.append(text);
    return this;
  }

  remove = (N: number, L?: number): Builder => {
    this.o.opcode = '-';
    this.o.attribs = '';
    this.o.chars = N;
    this.o.lines = (L || 0);
    this.assem.append(this.o);
    return this;
  }

  toString = () => {
    this.assem.endDocument();
    const newLen = this.oldLen + this.assem.getLengthChange();
    return pack(this.oldLen, newLen, this.assem.toString(), this.charBank.toString());
  }
}
