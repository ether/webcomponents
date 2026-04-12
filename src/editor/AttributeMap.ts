import AttributePool from "./AttributePool.js";
import {Attribute} from "./types/Attribute.js";
import attributes from './attributes.js';

class AttributeMap extends Map<string, string> {
  private readonly pool?: AttributePool|null

  public static fromString(str: string, pool?: AttributePool|null): AttributeMap {
    return new AttributeMap(pool).updateFromString(str);
  }

  constructor(pool?: AttributePool|null) {
    super();
    this.pool = pool;
  }

  set(k: string, v: string): this {
    k = k == null ? '' : String(k);
    v = v == null ? '' : String(v);
    this.pool!.putAttrib([k, v]);
    return super.set(k, v);
  }

  toString() {
    return attributes.attribsToString(attributes.sort([...this] as Attribute[]), this.pool!);
  }

  update(entries: Iterable<Attribute>, emptyValueIsDelete: boolean = false): AttributeMap {
    for (let [k, v] of entries) {
      k = k == null ? '' : String(k);
      v = v == null ? '' : String(v);
      if (!v && emptyValueIsDelete) {
        this.delete(k);
      } else {
        this.set(k, v);
      }
    }
    return this;
  }

  updateFromString(str: string, emptyValueIsDelete: boolean = false): AttributeMap {
    return this.update(attributes.attribsFromString(str, this.pool!), emptyValueIsDelete);
  }
}

export default AttributeMap
