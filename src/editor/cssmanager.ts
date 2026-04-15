export const makeCSSManager = (browserSheet: CSSStyleSheet) => {
  const browserRules = (): CSSRuleList => browserSheet.cssRules;
  const browserDeleteRule = (i: number): void => {
    browserSheet.deleteRule(i);
  };
  const browserInsertRule = (i: number, selector: string): void => {
    browserSheet.insertRule(`${selector} {}`, i);
  };
  const selectorList: string[] = [];
  const indexOfSelector = (selector: string): number => {
    for (let i = 0; i < selectorList.length; i++) {
      if (selectorList[i] === selector) return i;
    }
    return -1;
  };
  const selectorStyle = (selector: string): CSSStyleDeclaration => {
    let i = indexOfSelector(selector);
    if (i < 0) {
      browserInsertRule(0, selector);
      selectorList.splice(0, 0, selector);
      i = 0;
    }
    return (browserRules().item(i) as CSSStyleRule).style;
  };
  const removeSelectorStyle = (selector: string): void => {
    const i = indexOfSelector(selector);
    if (i >= 0) {
      browserDeleteRule(i);
      selectorList.splice(i, 1);
    }
  };
  return { selectorStyle, removeSelectorStyle, info: (): string => `${selectorList.length}:${browserRules().length}` };
};
