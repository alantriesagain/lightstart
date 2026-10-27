/**
 * @lightstart/light/html/states: what a child part currently renders, one
 * class per kind. A part tells them apart with `instanceof`, which a native
 * build checks as a class where a string tag would be compared as a string,
 * and a part that renders nothing, or a served range awaiting adoption,
 * shares one instance instead of making a record each time it clears.
 */

                                                          
                                                      
                                                        

export class EmptyState {
           empty = true;
}

export class PendingState {
           pending = true;
}

/** The state of every part that renders nothing. */
export const EMPTY = new EmptyState();

/** The state of every part whose served range awaits adoption. */
export const PENDING = new PendingState();

export class TextState {
  node          ;
  text        ;

  constructor(node          , text        ) {
    this.node = node;
    this.text = text;
  }
}

export class TemplateState {
  instance                  ;

  constructor(instance                  ) {
    this.instance = instance;
  }
}

/** A list's item parts and, for a list of `key()` items, each item's key; `keys` is empty for a list without keys. */
export class ItemsState {
  parts             ;
  keys           ;
  keyed         ;

  constructor(parts             , keys           , keyed         ) {
    this.parts = parts;
    this.keys = keys;
    this.keyed = keyed;
  }
}

export class KeyedState {
  k         ;
  inner           ;

  constructor(k         , inner           ) {
    this.k = k;
    this.inner = inner;
  }
}

export class NodeState {
  node          ;

  constructor(node          ) {
    this.node = node;
  }
}

export class UnsafeState {
  s        ;

  constructor(s        ) {
    this.s = s;
  }
}

/** The state of a child part rendering an `element()`: the element, what each binding committed, its listeners and its own child part. */
export class ElementState {
  tag        ;
  el          ;
  committed                      ;
  events                           ;
  ref                                           ;
  childPart                  ;

  constructor(tag        , el          ) {
    this.tag = tag;
    this.el = el;
    this.committed = new Map();
    this.events = new Map();
    this.ref = null;
    this.childPart = null;
  }
}

/** What a child part currently renders. */
                                                                                                                                                  
