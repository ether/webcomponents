import {Attribute} from "./types/Attribute.js";

interface AttributePoolJsonable {
  numToAttrib: Record<string, [string, string]>;
  nextNum: number;
}

class AttributePool {
  numToAttrib: Record<string, [string, string]>
  private attribToNum: Record<string, number>
  private nextNum: number

  constructor() {
    this.numToAttrib = {};
    this.attribToNum = {};
    this.nextNum = 0;
  }

  clone() {
    const c = new AttributePool();
    for (const [n, a] of Object.entries(this.numToAttrib)){
      c.numToAttrib[n] = [a[0], a[1]];
    }
    Object.assign(c.attribToNum, this.attribToNum);
    c.nextNum = this.nextNum;
    return c;
  }

  putAttrib(attrib: Attribute, dontAddIfAbsent = false) {
    const str = String(attrib);
    if (str in this.attribToNum) return this.attribToNum[str];
    if (dontAddIfAbsent) return -1;
    const num = this.nextNum++;
    this.attribToNum[str] = num;
    this.numToAttrib[num] = [String(attrib[0] || ''), String(attrib[1] || '')];
    return num;
  }

  getAttrib(num: number): Attribute | undefined {
    const pair = this.numToAttrib[num];
    if (!pair) return pair;
    return [pair[0], pair[1]];
  }

  getAttribKey(num: number): string {
    const pair = this.numToAttrib[num];
    if (!pair) return '';
    return pair[0];
  }

  getAttribValue(num: number) {
    const pair = this.numToAttrib[num];
    if (!pair) return '';
    return pair[1];
  }

  eachAttrib(func: (k: string, v: string) => void) {
    for (const n in this.numToAttrib) {
      const pair = this.numToAttrib[n];
      func(pair[0], pair[1]);
    }
  }

  toJsonable(): AttributePoolJsonable {
    return { numToAttrib: this.numToAttrib, nextNum: this.nextNum };
  }

  fromJsonable(obj: AttributePoolJsonable) {
    this.numToAttrib = obj.numToAttrib;
    this.nextNum = obj.nextNum;
    this.attribToNum = {};
    for (const n of Object.keys(this.numToAttrib)) {
      this.attribToNum[String(this.numToAttrib[n])] = Number(n);
    }
    return this;
  }

  check() {
    if (!Number.isInteger(this.nextNum)) throw new Error('nextNum property is not an integer');
    if (this.nextNum < 0) throw new Error('nextNum property is negative');
    for (const prop of ['numToAttrib', 'attribToNum'] as const) {
      const obj: Record<string, number> | Record<string, [string, string]> =
        prop === 'numToAttrib' ? this.numToAttrib : this.attribToNum;
      if (obj == null) throw new Error(`${prop} property is null`);
      if (typeof obj !== 'object') throw new TypeError(`${prop} property is not an object`);
      const keys = Object.keys(obj);
      if (keys.length !== this.nextNum) {
        throw new Error(`${prop} size mismatch (want ${this.nextNum}, got ${keys.length})`);
      }
    }
    for (let i = 0; i < this.nextNum; ++i) {
      const attr = this.numToAttrib[`${i}`];
      if (!Array.isArray(attr)) throw new TypeError(`attrib ${i} is not an array`);
      if (attr.length !== 2) throw new Error(`attrib ${i} is not an array of length 2`);
      const [k, v] = attr;
      if (k == null) throw new TypeError(`attrib ${i} key is null`);
      if (typeof k !== 'string') throw new TypeError(`attrib ${i} key is not a string`);
      if (v == null) throw new TypeError(`attrib ${i} value is null`);
      if (typeof v !== 'string') throw new TypeError(`attrib ${i} value is not a string`);
      const attrStr = String(attr);
      if (this.attribToNum[attrStr] !== i) throw new Error(`attribToNum for ${attrStr} !== ${i}`);
    }
  }
}

export default AttributePool
