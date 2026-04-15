export const isNodeText = (node: { nodeType: number }) => (node.nodeType === 3);

export const getAssoc = (obj: Record<string, any>, name: string) => obj[`_magicdom_${name}`];

export const setAssoc = (obj: Record<string, any>, name: string, value: string) => {
  obj[`_magicdom_${name}`] = value;
};

export const binarySearch = (numItems: number, func: (num: number) => boolean) => {
  if (numItems < 1) return 0;
  if (func(0)) return 0;
  if (!func(numItems - 1)) return numItems;
  let low = 0;
  let high = numItems - 1;
  while ((high - low) > 1) {
    const x = Math.floor((low + high) / 2);
    if (func(x)) high = x;
    else low = x;
  }
  return high;
};

export const binarySearchInfinite = (expectedLength: number, func: (num: number) => boolean) => {
  let i = 0;
  while (!func(i)) i += expectedLength;
  return binarySearch(i, func);
};

export const noop = () => {};
