import {RepModel} from "./types/RepModel.js";
import {ChangeSetBuilder} from "./types/ChangeSetBuilder.js";
import {Attribute} from "./types/Attribute.js";
import AttributePool from "./AttributePool.js";
import {Builder} from "./Builder.js";

export const buildRemoveRange = (rep: RepModel, builder: ChangeSetBuilder, start: [number,number], end: [number, number]) => {
  const startLineOffset = rep.lines.offsetOfIndex(start[0]);
  const endLineOffset = rep.lines.offsetOfIndex(end[0]);

  if (end[0] > start[0]) {
    builder.remove(endLineOffset - startLineOffset - start[1], end[0] - start[0]);
    builder.remove(end[1]);
  } else {
    builder.remove(end[1] - start[1]);
  }
};

export const buildKeepRange = (rep: RepModel, builder: ChangeSetBuilder, start: [number, number], end:[number, number], attribs?: Attribute[], pool?: AttributePool) => {
  const startLineOffset = rep.lines.offsetOfIndex(start[0]);
  const endLineOffset = rep.lines.offsetOfIndex(end[0]);

  if (end[0] > start[0]) {
    builder.keep(endLineOffset - startLineOffset - start[1], end[0] - start[0], attribs, pool);
    builder.keep(end[1], 0, attribs, pool);
  } else {
    builder.keep(end[1] - start[1], 0, attribs, pool);
  }
};

export const buildKeepToStartOfRange = (rep: RepModel, builder: Builder, start: [number, number]) => {
  const startLineOffset = rep.lines.offsetOfIndex(start[0]);

  builder.keep(startLineOffset, start[0]);
  builder.keep(start[1]);
};

export const parseNum = (str: string): number => parseInt(str, 36);

export const numToString = (num: number): string => num.toString(36).toLowerCase();
