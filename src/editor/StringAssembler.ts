export class StringAssembler {
  private str = ''
  clear = ()=> {
    this.str = '';
  }
  append(x: string) {
    this.str += String(x);
  }
  toString() {
    return this.str
  }
}
