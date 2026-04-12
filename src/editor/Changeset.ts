import AttributeMap from './AttributeMap.js'
import AttributePool from "./AttributePool.js";
import Op, {OpCode} from './Op.js'
import {numToString, parseNum} from './ChangesetUtils.js'
import {StringAssembler} from "./StringAssembler.js";
import {OpIter} from "./OpIter.js";
import {Attribute} from "./types/Attribute.js";
import {SmartOpAssembler} from "./SmartOpAssembler.js";
import TextLinesMutator from "./TextLinesMutator.js";
import {ChangeSet} from "./types/ChangeSet.js";
import {AText} from "./types/AText.js";
import {Builder} from "./Builder.js";
import {StringIterator} from "./StringIterator.js";
import {MergingOpAssembler} from "./MergingOpAssembler.js";

const error = (msg: string) => {
  const e = new Error(msg);
  (e as any).easysync = true;
  throw e;
};

export const assert: (b: boolean, msg: string) => asserts b = (b: boolean, msg: string): asserts b => {
  if (!b) error(`Failed assertion: ${msg}`);
};

export const oldLen = (cs: string) => unpack(cs).oldLen;
export const newLen = (cs: string) => unpack(cs).newLen;

export const deserializeOps = function* (ops: string) {
  const regex = /((?:\*[0-9a-z]+)*)(?:\|([0-9a-z]+))?([-+=])([0-9a-z]+)|(.)/g;
  let match;
  while ((match = regex.exec(ops)) != null) {
    if (match[5] === '$') return;
    if (match[5] != null) error(`invalid operation: ${ops.slice(regex.lastIndex - 1)}`);
    const opMatch = match[3] as ""|"=" | "+" | "-" | undefined;
    const op = new Op(opMatch);
    op.lines = parseNum(match[2] || '0');
    op.chars = parseNum(match[4]);
    op.attribs = match[1];
    yield op;
  }
};

export const opIterator = (opsStr: string) => new OpIter(opsStr);

export const clearOp = (op: Op) => {
  op.opcode = '';
  op.chars = 0;
  op.lines = 0;
  op.attribs = '';
};

export const newOp = (optOpcode:'+'|'-'|'='|'' ): Op => new Op(optOpcode);

export const copyOp = (op1: Op, op2: Op = new Op()): Op => Object.assign(op2, op1);

export const opsFromText = function* (opcode: "" | "=" | "+" | "-" | undefined, text: string, attribs: string|Attribute[] = '', pool: AttributePool|null = null) {
  const op = new Op(opcode);
  op.attribs = typeof attribs === 'string'
    ? attribs : new AttributeMap(pool).update(attribs || [], opcode === '+').toString();
  const lastNewlinePos = text.lastIndexOf('\n');
  if (lastNewlinePos < 0) {
    op.chars = text.length;
    op.lines = 0;
    yield op;
  } else {
    op.chars = lastNewlinePos + 1;
    op.lines = text.match(/\n/g)!.length;
    yield op;
    const op2 = copyOp(op);
    op2.chars = text.length - (lastNewlinePos + 1);
    op2.lines = 0;
    yield op2;
  }
};

export const checkRep = (cs: string) => {
  const unpacked = unpack(cs);
  const oldLen = unpacked.oldLen;
  const newLen = unpacked.newLen;
  const ops = unpacked.ops;
  let charBank = unpacked.charBank;
  const assem = new SmartOpAssembler();
  let oldPos = 0;
  let calcNewLen = 0;
  for (const o of deserializeOps(ops)) {
    switch (o.opcode) {
      case '=':
        oldPos += o.chars;
        calcNewLen += o.chars;
        break;
      case '-':
        oldPos += o.chars;
        assert(oldPos <= oldLen, `${oldPos} > ${oldLen} in ${cs}`);
        break;
      case '+':
      {
        assert(charBank.length >= o.chars, 'Invalid changeset: not enough chars in charBank');
        const chars = charBank.slice(0, o.chars);
        const nlines = (chars.match(/\n/g) || []).length;
        assert(nlines === o.lines, 'Invalid changeset: number of newlines in insert op does not match the charBank');
        assert(o.lines === 0 || chars.endsWith('\n'), 'Invalid changeset: multiline insert op does not end with a newline');
        charBank = charBank.slice(o.chars);
        calcNewLen += o.chars;
        assert(calcNewLen <= newLen, `${calcNewLen} > ${newLen} in ${cs}`);
        break;
      }
      default:
        assert(false, `Invalid changeset: Unknown opcode: ${JSON.stringify(o.opcode)}`);
    }
    assem.append(o);
  }
  calcNewLen += oldLen - oldPos;
  assert(calcNewLen === newLen, 'Invalid changeset: claimed length does not match actual length');
  assert(charBank === '', 'Invalid changeset: excess characters in the charBank');
  assem.endDocument();
  const normalized = pack(oldLen, calcNewLen, assem.toString(), unpacked.charBank);
  assert(normalized === cs, 'Invalid changeset: not in canonical form');
  return cs;
};

const applyZip = (in1: string, in2: string, func: (op1: Op, op2: Op) => Op): string => {
  const ops1 = deserializeOps(in1);
  const ops2 = deserializeOps(in2);
  let next1 = ops1.next();
  let next2 = ops2.next();
  const assem = new SmartOpAssembler();
  while (!next1.done || !next2.done) {
    if (!next1.done && !next1.value.opcode) next1 = ops1.next();
    if (!next2.done && !next2.value.opcode) next2 = ops2.next();
    if (next1.value == null) next1.value = new Op();
    if (next2.value == null) next2.value = new Op();
    if (!next1.value.opcode && !next2.value.opcode) break;
    const opOut = func(next1.value, next2.value);
    if (opOut && opOut.opcode) assem.append(opOut);
  }
  assem.endDocument();
  return assem.toString();
};

export const unpack = (cs: string): ChangeSet => {
  const headerRegex = /Z:([0-9a-z]+)([><])([0-9a-z]+)|/;
  const headerMatch = headerRegex.exec(cs);
  if ((!headerMatch) || (!headerMatch[0])) error(`Not a changeset: ${cs}`);
  const oldLen = parseNum(headerMatch![1]);
  const changeSign = (headerMatch![2] === '>') ? 1 : -1;
  const changeMag = parseNum(headerMatch![3]);
  const newLen = oldLen + changeSign * changeMag;
  const opsStart = headerMatch![0].length;
  let opsEnd = cs.indexOf('$');
  if (opsEnd < 0) opsEnd = cs.length;
  return { oldLen, newLen, ops: cs.substring(opsStart, opsEnd), charBank: cs.substring(opsEnd + 1) };
};

export const pack = (oldLen: number, newLen: number, opsStr: string, bank: string): string => {
  const lenDiff = newLen - oldLen;
  const lenDiffStr = (lenDiff >= 0 ? `>${numToString(lenDiff)}` : `<${numToString(-lenDiff)}`);
  return ['Z:', numToString(oldLen), lenDiffStr, opsStr, '$', bank].join('');
};

export const applyToText = (cs: string, str: string): string => {
  const unpacked = unpack(cs);
  assert(str.length === unpacked.oldLen, `mismatched apply: ${str.length} / ${unpacked.oldLen}`);
  const bankIter = new StringIterator(unpacked.charBank);
  const strIter = new StringIterator(str);
  const assem = new StringAssembler();
  for (const op of deserializeOps(unpacked.ops)) {
    switch (op.opcode) {
      case '+':
        assem.append(bankIter.take(op.chars));
        break;
      case '-':
        strIter.skip(op.chars);
        break;
      case '=':
        assem.append(strIter.take(op.chars));
        break;
    }
  }
  assem.append(strIter.take(strIter.remaining()));
  return assem.toString();
};

export const mutateTextLines = (cs: string, lines: RegExpMatchArray|string[] | null) => {
  const unpacked = unpack(cs);
  const bankIter = new StringIterator(unpacked.charBank);
  const mut = new TextLinesMutator(lines!);
  for (const op of deserializeOps(unpacked.ops)) {
    switch (op.opcode) {
      case '+': mut.insert(bankIter.take(op.chars), op.lines); break;
      case '-': mut.remove(op.chars, op.lines); break;
      case '=': mut.skip(op.chars, op.lines, (!!op.attribs)); break;
    }
  }
  mut.close();
};

export const composeAttributes = (att1: string, att2: string, resultIsMutation: boolean, pool?: AttributePool|null): string => {
  if ((!att1) && resultIsMutation) return att2;
  if (!att2) return att1;
  return AttributeMap.fromString(att1, pool).updateFromString(att2, !resultIsMutation).toString();
};

export const mutateAttributionLines = (cs: string, lines: string[] | RegExpMatchArray, pool: AttributePool | null) => {
  const unpacked = unpack(cs);
  const csOps = deserializeOps(unpacked.ops);
  let csOpsNext = csOps.next();
  const csBank = unpacked.charBank;
  let csBankIndex = 0;
  const mut = new TextLinesMutator(lines);
  let lineOps: Generator<Op> | null = null;
  let lineOpsNext: IteratorResult<Op> | null = null;
  const lineOpsHasNext = () => lineOpsNext && !lineOpsNext.done;
  const isNextMutOp = () => lineOpsHasNext() || mut.hasMore();
  const nextMutOp = () => {
    if (!lineOpsHasNext() && mut.hasMore()) {
      const line = mut.removeLines(1);
      lineOps = deserializeOps(line);
      lineOpsNext = lineOps.next();
    }
    if (!lineOpsHasNext()) return new Op();
    const op = lineOpsNext!.value;
    lineOpsNext = lineOps!.next();
    return op;
  };
  let lineAssem: MergingOpAssembler | null = null;
  const outputMutOp = (op: Op) => {
    if (!lineAssem) lineAssem = new MergingOpAssembler();
    lineAssem.append(op);
    if (op.lines <= 0) return;
    assert(op.lines === 1, `Can't have op.lines of ${op.lines} in attribution lines`);
    mut.insert(lineAssem.toString(), 1);
    lineAssem = null;
  };
  let csOp = new Op();
  let attOp = new Op();
  while (csOp.opcode || !csOpsNext.done || attOp.opcode || isNextMutOp()) {
    if (!csOp.opcode && !csOpsNext.done) {
      csOp = csOpsNext.value;
      csOpsNext = csOps.next();
    }
    if (!csOp.opcode && !attOp.opcode && !lineAssem && !lineOpsHasNext()) {
      break;
    } else if (csOp.opcode === '=' && csOp.lines > 0 && !csOp.attribs && !attOp.opcode && !lineAssem && !lineOpsHasNext()) {
      mut.skipLines(csOp.lines);
      csOp.opcode = '';
    } else if (csOp.opcode === '+') {
      const opOut = copyOp(csOp);
      if (csOp.lines > 1) {
        const firstLineLen = csBank.indexOf('\n', csBankIndex) + 1 - csBankIndex;
        csOp.chars -= firstLineLen;
        csOp.lines--;
        opOut.lines = 1;
        opOut.chars = firstLineLen;
      } else {
        csOp.opcode = '';
      }
      outputMutOp(opOut);
      csBankIndex += opOut.chars;
    } else {
      if (!attOp.opcode && isNextMutOp()) attOp = nextMutOp();
      const opOut = slicerZipperFunc(attOp, csOp, pool);
      if (opOut.opcode) outputMutOp(opOut);
    }
  }
  assert(!lineAssem, `line assembler not finished:${cs}`);
  mut.close();
};

export const slicerZipperFunc = (attOp: Op, csOp: Op, pool: AttributePool|null):Op => {
  const opOut = new Op();
  if (!attOp.opcode) {
    copyOp(csOp, opOut);
    csOp.opcode = '';
  } else if (!csOp.opcode) {
    copyOp(attOp, opOut);
    attOp.opcode = '';
  } else if (attOp.opcode === '-') {
    copyOp(attOp, opOut);
    attOp.opcode = '';
  } else if (csOp.opcode === '+') {
    copyOp(csOp, opOut);
    csOp.opcode = '';
  } else {
    for (const op of [attOp, csOp]) {
      assert(op.chars >= op.lines, `op has more newlines than chars: ${op.toString()}`);
    }
    assert(
      attOp.chars < csOp.chars ? attOp.lines <= csOp.lines
        : attOp.chars > csOp.chars ? attOp.lines >= csOp.lines
          : attOp.lines === csOp.lines,
      'line count mismatch when composing changesets');
    assert(['+', '='].includes(attOp.opcode), `unexpected opcode in op: ${attOp.toString()}`);
    assert(['-', '='].includes(csOp.opcode), `unexpected opcode in op: ${csOp.toString()}`);
    opOut.opcode = {
      '+': { '-': '', '=': '+' },
      '=': { '-': '-', '=': '=' },
    }[attOp.opcode][csOp.opcode] as OpCode;
    const [fullyConsumedOp, partiallyConsumedOp] = [attOp, csOp].sort((a, b) => a.chars - b.chars);
    opOut.chars = fullyConsumedOp.chars;
    opOut.lines = fullyConsumedOp.lines;
    opOut.attribs = csOp.opcode === '-'
      ? csOp.attribs
      : composeAttributes(attOp.attribs, csOp.attribs, attOp.opcode === '=', pool);
    partiallyConsumedOp.chars -= fullyConsumedOp.chars;
    partiallyConsumedOp.lines -= fullyConsumedOp.lines;
    if (!partiallyConsumedOp.chars) partiallyConsumedOp.opcode = '';
    fullyConsumedOp.opcode = '';
  }
  return opOut;
};

export const applyToAttribution = (cs: string, astr: string, pool: AttributePool): string => {
  const unpacked = unpack(cs);
  return applyZip(astr, unpacked.ops, (op1: Op, op2:Op) => slicerZipperFunc(op1, op2, pool));
};

export const joinAttributionLines = (theAlines: string[]): string => {
  const assem = new MergingOpAssembler();
  for (const aline of theAlines) {
    for (const op of deserializeOps(aline)) assem.append(op);
  }
  return assem.toString();
};

export const splitAttributionLines = (attrOps: string, text: string) => {
  const assem = new MergingOpAssembler();
  const lines: string[] = [];
  let pos = 0;
  const appendOp = (op:Op) => {
    assem.append(op);
    if (op.lines > 0) {
      lines.push(assem.toString());
      assem.clear();
    }
    pos += op.chars;
  };
  for (const op of deserializeOps(attrOps)) {
    let numChars = op.chars;
    let numLines = op.lines;
    while (numLines > 1) {
      const newlineEnd = text.indexOf('\n', pos) + 1;
      assert(newlineEnd > 0, 'newlineEnd <= 0 in splitAttributionLines');
      op.chars = newlineEnd - pos;
      op.lines = 1;
      appendOp(op);
      numChars -= op.chars;
      numLines -= op.lines;
    }
    if (numLines === 1) {
      op.chars = numChars;
      op.lines = 1;
    }
    appendOp(op);
  }
  return lines;
};

export const splitTextLines = (text:string) => text.match(/[^\n]*(?:\n|[^\n]$)/g);

export const compose = (cs1: string, cs2:string, pool: AttributePool): string => {
  const unpacked1 = unpack(cs1);
  const unpacked2 = unpack(cs2);
  const len1 = unpacked1.oldLen;
  const len2 = unpacked1.newLen;
  assert(len2 === unpacked2.oldLen, 'mismatched composition of two changesets');
  const len3 = unpacked2.newLen;
  const bankIter1 = new StringIterator(unpacked1.charBank);
  const bankIter2 = new StringIterator(unpacked2.charBank);
  const bankAssem = new StringAssembler();
  const newOps = applyZip(unpacked1.ops, unpacked2.ops, (op1: Op, op2: Op) => {
    const op1code = op1.opcode;
    const op2code = op2.opcode;
    if (op1code === '+' && op2code === '-') {
      bankIter1.skip(Math.min(op1.chars, op2.chars));
    }
    const opOut = slicerZipperFunc(op1, op2, pool);
    if (opOut.opcode === '+') {
      if (op2code === '+') {
        bankAssem.append(bankIter2.take(opOut.chars));
      } else {
        bankAssem.append(bankIter1.take(opOut.chars));
      }
    }
    return opOut;
  });
  return pack(len1, len3, newOps, bankAssem.toString());
};

export const attributeTester = (attribPair: Attribute, pool: AttributePool): (attribs: string) => boolean => {
  const never = () => false;
  if (!pool) return never;
  const attribNum = pool.putAttrib(attribPair, true);
  if (attribNum < 0) return never;
  const re = new RegExp(`\\*${numToString(attribNum)}(?!\\w)`);
  return (attribs: string) => re.test(attribs);
};

export const identity = (N: number): string => pack(N, N, '', '');

export const makeSplice = (orig: string, start: number, ndel: number, ins: string|null, attribs?: string | Attribute[] | undefined, pool?: AttributePool | null | undefined): string => {
  if (start < 0) throw new RangeError(`start index must be non-negative (is ${start})`);
  if (ndel < 0) throw new RangeError(`characters to delete must be non-negative (is ${ndel})`);
  if (start > orig.length) start = orig.length;
  if (ndel > orig.length - start) ndel = orig.length - start;
  const deleted = orig.substring(start, start + ndel);
  const assem = new SmartOpAssembler();
  const ops = (function* () {
    yield* opsFromText('=', orig.substring(0, start));
    yield* opsFromText('-', deleted);
    yield* opsFromText('+', ins as string, attribs, pool);
  })();
  for (const op of ops) assem.append(op);
  assem.endDocument();
  return pack(orig.length, orig.length + ins!.length - ndel, assem.toString(), ins!);
};

export const characterRangeFollow = (cs: string, startChar: number, endChar: number, insertionsAfter: number):[number, number] => {
  let newStartChar = startChar;
  let newEndChar = endChar;
  let lengthChangeSoFar = 0;
  for (const splice of toSplices(cs)) {
    const spliceStart = splice[0] + lengthChangeSoFar;
    const spliceEnd = splice[1] + lengthChangeSoFar;
    const newTextLength = splice[2].length;
    const thisLengthChange = newTextLength - (spliceEnd - spliceStart);
    if (spliceStart <= newStartChar && spliceEnd >= newEndChar) {
      if (insertionsAfter) { newStartChar = newEndChar = spliceStart; }
      else { newStartChar = newEndChar = spliceStart + newTextLength; }
    } else if (spliceEnd <= newStartChar) {
      newStartChar += thisLengthChange;
      newEndChar += thisLengthChange;
    } else if (spliceStart >= newEndChar) {
      // splice is after range
    } else if (spliceStart >= newStartChar && spliceEnd <= newEndChar) {
      newEndChar += thisLengthChange;
    } else if (spliceEnd < newEndChar) {
      newStartChar = spliceStart + newTextLength;
      newEndChar += thisLengthChange;
    } else {
      newEndChar = spliceStart;
    }
    lengthChangeSoFar += thisLengthChange;
  }
  return [newStartChar, newEndChar];
};

const toSplices = (cs: string): [number, number, string][] => {
  const unpacked = unpack(cs);
  const splices: [number, number, string][] = [];
  let oldPos = 0;
  const charIter = new StringIterator(unpacked.charBank);
  let inSplice = false;
  for (const op of deserializeOps(unpacked.ops)) {
    if (op.opcode === '=') {
      oldPos += op.chars;
      inSplice = false;
    } else {
      if (!inSplice) {
        splices.push([oldPos, oldPos, '']);
        inSplice = true;
      }
      if (op.opcode === '-') {
        oldPos += op.chars;
        splices[splices.length - 1][1] += op.chars;
      } else if (op.opcode === '+') {
        splices[splices.length - 1][2] += charIter.take(op.chars);
      }
    }
  }
  return splices;
};

export const moveOpsToNewPool = (cs: string, oldPool: AttributePool, newPool: AttributePool): string => {
  let dollarPos = cs.indexOf('$');
  if (dollarPos < 0) dollarPos = cs.length;
  const upToDollar = cs.substring(0, dollarPos);
  const fromDollar = cs.substring(dollarPos);
  return upToDollar.replace(/\*([0-9a-z]+)/g, (_, a) => {
    const oldNum = parseNum(a);
    const pair = oldPool.getAttrib(oldNum);
    if (!pair) return '';
    const newNum = newPool.putAttrib(pair);
    return `*${numToString(newNum)}`;
  }) + fromDollar;
};

export const makeAttribution = (text: string) => {
  const assem = new SmartOpAssembler();
  for (const op of opsFromText('+', text)) assem.append(op);
  return assem.toString();
};

export const eachAttribNumber = (cs: string, func: (num: number) => void) => {
  let dollarPos = cs.indexOf('$');
  if (dollarPos < 0) dollarPos = cs.length;
  const upToDollar = cs.substring(0, dollarPos);
  upToDollar.replace(/\*([0-9a-z]+)/g, (_, a) => {
    func(parseNum(a));
    return '';
  });
};

export const filterAttribNumbers = (cs: string, filter: (num: number) => boolean | number) => mapAttribNumbers(cs, filter);

export const mapAttribNumbers = (cs: string, func: (num: number) => boolean | number): string => {
  let dollarPos = cs.indexOf('$');
  if (dollarPos < 0) dollarPos = cs.length;
  const upToDollar = cs.substring(0, dollarPos);
  const newUpToDollar = upToDollar.replace(/\*([0-9a-z]+)/g, (s, a) => {
    const n = func(parseNum(a));
    if (n === true) return s;
    else if ((typeof n) === 'number') return `*${numToString(n)}`;
    else return '';
  });
  return newUpToDollar + cs.substring(dollarPos);
};

export const makeAText = (text: string, attribs?: string): AText => ({
  text,
  attribs: (attribs || makeAttribution(text)),
});

export const applyToAText = (cs: string, atext: AText, pool: AttributePool): AText => ({
  text: applyToText(cs, atext.text),
  attribs: applyToAttribution(cs, atext.attribs, pool),
});

export const cloneAText = (atext: AText): AText => {
  if (!atext) error('atext is null');
  return { text: atext.text, attribs: atext.attribs };
};

export const copyAText = (atext1: AText, atext2: AText) => {
  atext2.text = atext1.text;
  atext2.attribs = atext1.attribs;
};

export const opsFromAText = function* (atext: AText): Generator<Op> {
  let lastOp = null;
  for (const op of deserializeOps(atext.attribs)) {
    if (lastOp != null) yield lastOp;
    lastOp = op;
  }
  if (lastOp == null) return;
  if (lastOp.lines <= 1) {
    lastOp.lines = 0;
    lastOp.chars--;
  } else {
    const nextToLastNewlineEnd = atext.text.lastIndexOf('\n', atext.text.length - 2) + 1;
    const lastLineLength = atext.text.length - nextToLastNewlineEnd - 1;
    lastOp.lines--;
    lastOp.chars -= (lastLineLength + 1);
    yield copyOp(lastOp);
    lastOp.lines = 0;
    lastOp.chars = lastLineLength;
  }
  if (lastOp.chars) yield lastOp;
};

export const appendATextToAssembler = (atext: AText, assem: SmartOpAssembler) => {
  for (const op of opsFromAText(atext)) assem.append(op);
};

export const prepareForWire = (cs: string, pool: AttributePool) => {
  const newPool = new AttributePool();
  const newCs = moveOpsToNewPool(cs, pool, newPool);
  return { translated: newCs, pool: newPool };
};

export const isIdentity = (cs: string): boolean => {
  const unpacked = unpack(cs);
  return unpacked.ops === '' && unpacked.oldLen === unpacked.newLen;
};

export const subattribution = (astr: string, start: number, optEnd?: number) => {
  const attOps = deserializeOps(astr);
  let attOpsNext = attOps.next();
  const assem = new SmartOpAssembler();
  let attOp = new Op();
  const csOp = new Op();
  const doCsOp = () => {
    if (!csOp.chars) return;
    while (csOp.opcode && (attOp.opcode || !attOpsNext.done)) {
      if (!attOp.opcode) {
        attOp = attOpsNext.value as Op;
        attOpsNext = attOps.next();
      }
      if (csOp.opcode && attOp.opcode && csOp.chars >= attOp.chars && attOp.lines > 0 && csOp.lines <= 0) {
        csOp.lines++;
      }
      const opOut = slicerZipperFunc(attOp, csOp, null);
      if (opOut.opcode) assem.append(opOut);
    }
  };
  csOp.opcode = '-';
  csOp.chars = start;
  doCsOp();
  if (optEnd === undefined) {
    if (attOp.opcode) assem.append(attOp);
    while (!attOpsNext.done) {
      assem.append(attOpsNext.value);
      attOpsNext = attOps.next();
    }
  } else {
    csOp.opcode = '=';
    csOp.chars = optEnd - start;
    doCsOp();
  }
  return assem.toString();
};

export const inverse = (cs: string, lines: string|RegExpMatchArray|string[] | null, alines: string[]|{
  get: (idx: number) => string,
}, pool: AttributePool) => {
  const linesGet = (idx: number) => {
    if (lines && typeof lines === 'object' && "get" in lines) return (lines as any).get(idx);
    return lines![idx];
  };
  const alinesGet = (idx: number): string => {
    if (typeof alines === 'object' && "get" in alines) return (alines as any).get(idx);
    return (alines as string[])[idx];
  };
  let curLine = 0;
  let curChar = 0;
  let curLineOps: null|Generator<Op> = null;
  let curLineOpsNext:IteratorResult<Op>|null = null;
  let curLineOpsLine: number;
  let curLineNextOp = new Op('+');
  const unpacked = unpack(cs);
  const builder = new Builder(unpacked.newLen);
  const consumeAttribRuns = (numChars: number, func: (chars: number, attribs: string, endsLine: boolean) => void) => {
    if (!curLineOps || curLineOpsLine !== curLine) {
      curLineOps = deserializeOps(alinesGet(curLine));
      curLineOpsNext = curLineOps.next();
      curLineOpsLine = curLine;
      let indexIntoLine = 0;
      while (!curLineOpsNext.done) {
        curLineNextOp = curLineOpsNext.value;
        curLineOpsNext = curLineOps.next();
        if (indexIntoLine + curLineNextOp.chars >= curChar) {
          curLineNextOp.chars -= (curChar - indexIntoLine);
          break;
        }
        indexIntoLine += curLineNextOp.chars;
      }
    }
    while (numChars > 0) {
      if (!curLineNextOp.chars && curLineOpsNext!.done) {
        curLine++;
        curChar = 0;
        curLineOpsLine = curLine;
        curLineNextOp.chars = 0;
        curLineOps = deserializeOps(alinesGet(curLine));
        curLineOpsNext = curLineOps!.next();
      }
      if (!curLineNextOp.chars) {
        if (curLineOpsNext!.done) { curLineNextOp = new Op(); }
        else { curLineNextOp = curLineOpsNext!.value; curLineOpsNext = curLineOps.next(); }
      }
      const charsToUse = Math.min(numChars, curLineNextOp.chars);
      func(charsToUse, curLineNextOp.attribs, charsToUse === curLineNextOp.chars && curLineNextOp.lines > 0);
      numChars -= charsToUse;
      curLineNextOp.chars -= charsToUse;
      curChar += charsToUse;
    }
    if (!curLineNextOp.chars && curLineOpsNext!.done) { curLine++; curChar = 0; }
  };
  const skip = (N: number, L: number) => {
    if (L) { curLine += L; curChar = 0; }
    else if (curLineOps && curLineOpsLine === curLine) { consumeAttribRuns(N, () => {}); }
    else { curChar += N; }
  };
  const nextText = (numChars: number) => {
    let len = 0;
    const assem = new StringAssembler();
    const firstString = linesGet(curLine).substring(curChar);
    len += firstString.length;
    assem.append(firstString);
    let lineNum = curLine + 1;
    while (len < numChars) {
      const nextString = linesGet(lineNum);
      len += nextString.length;
      assem.append(nextString);
      lineNum++;
    }
    return assem.toString().substring(0, numChars);
  };
  const cachedStrFunc = (func: (s: string) => string) => {
    const cache: Record<string, string> = {};
    return (s: string) => { if (!cache[s]) cache[s] = func(s); return cache[s]; };
  };
  for (const csOp of deserializeOps(unpacked.ops)) {
    if (csOp.opcode === '=') {
      if (csOp.attribs) {
        const attribs = AttributeMap.fromString(csOp.attribs, pool);
        const undoBackToAttribs = cachedStrFunc((oldAttribsStr: string) => {
          const oldAttribs = AttributeMap.fromString(oldAttribsStr, pool);
          const backAttribs = new AttributeMap(pool);
          for (const [key, value] of attribs) {
            const oldValue = oldAttribs.get(key) || '';
            if (oldValue !== value) backAttribs.set(key, oldValue);
          }
          return backAttribs.toString();
        });
        consumeAttribRuns(csOp.chars, (len: number, attribs: string, endsLine: boolean) => {
          builder.keep(len, endsLine ? 1 : 0, undoBackToAttribs(attribs));
        });
      } else {
        skip(csOp.chars, csOp.lines);
        builder.keep(csOp.chars, csOp.lines);
      }
    } else if (csOp.opcode === '+') {
      builder.remove(csOp.chars, csOp.lines);
    } else if (csOp.opcode === '-') {
      const textBank = nextText(csOp.chars);
      let textBankIndex = 0;
      consumeAttribRuns(csOp.chars, (len: number, attribs: string) => {
        builder.insert(textBank.substr(textBankIndex, len), attribs);
        textBankIndex += len;
      });
    }
  }
  return checkRep(builder.toString());
};

export const follow = (cs1: string, cs2:string, reverseInsertOrder: boolean, pool: AttributePool) => {
  const unpacked1 = unpack(cs1);
  const unpacked2 = unpack(cs2);
  const len1 = unpacked1.oldLen;
  const len2 = unpacked2.oldLen;
  assert(len1 === len2, 'mismatched follow - cannot transform cs1 on top of cs2');
  const chars1 = new StringIterator(unpacked1.charBank);
  const chars2 = new StringIterator(unpacked2.charBank);
  const oldLen = unpacked1.newLen;
  let oldPos = 0;
  let newLen = 0;
  const hasInsertFirst = attributeTester(['insertorder', 'first'], pool);
  const newOps = applyZip(unpacked1.ops, unpacked2.ops, (op1: Op, op2: Op) => {
    const opOut = new Op();
    if (op1.opcode === '+' || op2.opcode === '+') {
      let whichToDo;
      if (op2.opcode !== '+') { whichToDo = 1; }
      else if (op1.opcode !== '+') { whichToDo = 2; }
      else {
        const firstChar1 = chars1.peek(1);
        const firstChar2 = chars2.peek(1);
        const insertFirst1 = hasInsertFirst(op1.attribs);
        const insertFirst2 = hasInsertFirst(op2.attribs);
        if (insertFirst1 && !insertFirst2) { whichToDo = 1; }
        else if (insertFirst2 && !insertFirst1) { whichToDo = 2; }
        else if (firstChar1 === '\n' && firstChar2 !== '\n') { whichToDo = 2; }
        else if (firstChar1 !== '\n' && firstChar2 === '\n') { whichToDo = 1; }
        else if (reverseInsertOrder) { whichToDo = 2; }
        else { whichToDo = 1; }
      }
      if (whichToDo === 1) {
        chars1.skip(op1.chars);
        opOut.opcode = '=';
        opOut.lines = op1.lines;
        opOut.chars = op1.chars;
        opOut.attribs = '';
        op1.opcode = '';
      } else {
        chars2.skip(op2.chars);
        copyOp(op2, opOut);
        op2.opcode = '';
      }
    } else if (op1.opcode === '-') {
      if (!op2.opcode) { op1.opcode = ''; }
      else if (op1.chars <= op2.chars) {
        op2.chars -= op1.chars; op2.lines -= op1.lines; op1.opcode = '';
        if (!op2.chars) op2.opcode = '';
      } else {
        op1.chars -= op2.chars; op1.lines -= op2.lines; op2.opcode = '';
      }
    } else if (op2.opcode === '-') {
      copyOp(op2, opOut);
      if (!op1.opcode) { op2.opcode = ''; }
      else if (op2.chars <= op1.chars) {
        op1.chars -= op2.chars; op1.lines -= op2.lines; op2.opcode = '';
        if (!op1.chars) op1.opcode = '';
      } else {
        opOut.lines = op1.lines; opOut.chars = op1.chars;
        op2.lines -= op1.lines; op2.chars -= op1.chars; op1.opcode = '';
      }
    } else if (!op1.opcode) {
      copyOp(op2, opOut); op2.opcode = '';
    } else if (!op2.opcode) {
      op1.opcode = '';
    } else {
      opOut.opcode = '=';
      opOut.attribs = followAttributes(op1.attribs, op2.attribs, pool);
      if (op1.chars <= op2.chars) {
        opOut.chars = op1.chars; opOut.lines = op1.lines;
        op2.chars -= op1.chars; op2.lines -= op1.lines; op1.opcode = '';
        if (!op2.chars) op2.opcode = '';
      } else {
        opOut.chars = op2.chars; opOut.lines = op2.lines;
        op1.chars -= op2.chars; op1.lines -= op2.lines; op2.opcode = '';
      }
    }
    switch (opOut.opcode) {
      case '=': oldPos += opOut.chars; newLen += opOut.chars; break;
      case '-': oldPos += opOut.chars; break;
      case '+': newLen += opOut.chars; break;
    }
    return opOut;
  });
  newLen += oldLen - oldPos;
  return pack(oldLen, newLen, newOps, unpacked2.charBank);
};

const followAttributes = (att1: string, att2: string, pool: AttributePool) => {
  if ((!att2) || (!pool)) return '';
  if (!att1) return att2;
  const atts = new Map();
  att2.replace(/\*([0-9a-z]+)/g, (_, a) => {
    const attrib = pool.getAttrib(parseNum(a));
    if (!attrib) return '';
    const [key, val] = attrib;
    atts.set(key, val);
    return '';
  });
  att1.replace(/\*([0-9a-z]+)/g, (_, a) => {
    const attrib = pool.getAttrib(parseNum(a));
    if (!attrib) return '';
    const [key, val] = attrib;
    if (atts.has(key) && val <= atts.get(key)) atts.delete(key);
    return '';
  });
  const buf = new StringAssembler();
  for (const att of atts) {
    buf.append('*');
    buf.append(numToString(pool.putAttrib(att)));
  }
  return buf.toString();
};

export const exportedForTestingOnly = { TextLinesMutator, followAttributes, toSplices };
