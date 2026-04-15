import AttributePool from "./AttributePool.js";
import {Attribute} from "./types/Attribute.js";

export const decodeAttribString = function* (str: string): Generator<number> {
  const re = /\*([0-9a-z]+)|./gy;
  let match;
  while ((match = re.exec(str)) != null) {
    const [m, n] = match;
    if (n == null) throw new Error(`invalid character in attribute string: ${m}`);
    yield Number.parseInt(n, 36);
  }
};

const checkAttribNum = (n: number|object) => {
  if (typeof n !== 'number') throw new TypeError(`not a number: ${n}`);
  if (n < 0) throw new Error(`attribute number is negative: ${n}`);
  if (n !== Math.trunc(n)) throw new Error(`attribute number is not an integer: ${n}`);
};

export const encodeAttribString = (attribNums: Iterable<number>): string => {
  let str = '';
  for (const n of attribNums) {
    checkAttribNum(n);
    str += `*${n.toString(36).toLowerCase()}`;
  }
  return str;
};

export const attribsFromNums = function* (attribNums: Iterable<number>, pool: AttributePool): Generator<Attribute> {
  for (const n of attribNums) {
    checkAttribNum(n);
    const attrib = pool.getAttrib(n);
    if (attrib == null) throw new Error(`attribute ${n} does not exist in pool`);
    yield attrib;
  }
};

export const attribsToNums = function* (attribs: Iterable<Attribute>, pool: AttributePool) {
  for (const attrib of attribs) yield pool.putAttrib(attrib);
};

export const attribsFromString = function* (str: string, pool: AttributePool): Generator<Attribute> {
  yield* attribsFromNums(decodeAttribString(str), pool);
};

export const attribsToString =
  (attribs: Iterable<Attribute>, pool: AttributePool): string => encodeAttribString(attribsToNums(attribs, pool));

export const sort = (attribs: Attribute[]): Attribute[] => attribs.sort(([keyA], [keyB]) => (keyA > keyB ? 1 : 0) - (keyA < keyB ? 1 : 0));

export default {
  decodeAttribString,
  encodeAttribString,
  attribsFromNums,
  attribsToNums,
  attribsFromString,
  attribsToString,
  sort,
}
