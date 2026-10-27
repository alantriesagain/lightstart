/**
 * @bootstrapp/light/html/host: the renderer behind the parts engine. The
 * engine never touches a document; it asks the installed host to prepare and
 * clone templates, create and move nodes, write attributes, properties and
 * text, and bind listeners. The browser host is `dom/host.js`; a terminal or
 * string host implements the same class. `configure({ host })` installs one;
 * until then every method throws, so a page that renders without a host
 * fails at its first render rather than later.
 */

                                      
                                           
                                               

/** An opaque node of the active host; only the host reads it. */
                               

const unsupported = (what        )        => {
  throw new Error(`[light/html] the active host does not support ${what}`);
};

/** A template the host prepared: the part specs in document order, plus whatever the host keeps beside them. */
export class Prepared {
  parts            ;

  constructor(parts            ) {
    this.parts = parts;
  }
}

/** A fresh copy of a prepared template: its root (a fragment or a list holder) and the node each part binds to, in `parts` order. */
export class Clone {
  root         ;
  targets           ;

  constructor(root          , targets            ) {
    this.root = root;
    this.targets = targets;
  }
}

/** Listener options as the engine compares them; a host reads them off a handler object it understands. */
export class ListenerOptions {
  capture         ;
  once         ;
  passive         ;

  constructor(capture         , once         , passive         ) {
    this.capture = capture;
    this.once = once;
    this.passive = passive;
  }

  equals(other                        ) {
    return other !== null && other.capture === this.capture && other.once === this.once && other.passive === this.passive;
  }
}

/** The renderer interface. Every method throws here; a host overrides what it supports. */
export class Host {
  /**
   * Whether a handler function is called with the owner as `this`, as in a
   * browser; a host that cannot bind one calls it with the event alone.
   */
  bindsHandlerThis          = true;

  prepare(strings                       , kind        )           {
    return unsupported(`templates (${String(strings.length)} strings, kind ${String(kind)})`);
  }

  clone(prepared          )        {
    return unsupported(`cloning templates (${String(prepared.parts.length)} parts)`);
  }

  createText(text        )           {
    return unsupported(`text nodes (${JSON.stringify(text)})`);
  }

  setText(node          , text        ) {
    unsupported(`text updates (${JSON.stringify(text)}, ${String(node === null)})`);
  }

  createAnchor(label        )           {
    return unsupported(`anchors (${label})`);
  }

  createElement(tag        )           {
    return unsupported(`elements (<${tag}>)`);
  }

  /** @returns a parent whose children move out of it when it is inserted */
  createFragment()           {
    return unsupported("fragments");
  }

  insertBefore(parent          , node          , ref                 ) {
    unsupported(`insertion (${String(parent === node)}, ${String(ref === null)})`);
  }

  /** @param node detach through the host's own primitive, never a method the node may override */
  remove(node          ) {
    unsupported(`removal (${String(node === null)})`);
  }

  parentOf(node          )                  {
    return unsupported(`parent lookup (${String(node === null)})`);
  }

  nextSibling(node          )                  {
    return unsupported(`sibling lookup (${String(node === null)})`);
  }

  isConnected(node          )          {
    return unsupported(`connectivity (${String(node === null)})`);
  }

  /**
   * The node a child-position value stands for, or null when the value is not a node of this host.
   */
  asNode(value         )                  {
    return value === null ? null : null;
  }

  /**
   * A non-array iterable as a list, or null when the value is not one.
   */
  toList(value         )                   {
    return value === null ? null : null;
  }

  /**
   * The text for a child value the engine cannot classify (an object).
   */
  stringify(value         )         {
    return unsupported(`unknown child values (${typeof value})`);
  }

  setAttribute(el          , name        , value        ) {
    unsupported(`attributes (${name}=${JSON.stringify(value)}, ${String(el === null)})`);
  }

  removeAttribute(el          , name        ) {
    unsupported(`attribute removal (${name}, ${String(el === null)})`);
  }

  toggleAttribute(el          , name        , on         ) {
    unsupported(`boolean attributes (${name}=${String(on)}, ${String(el === null)})`);
  }

  setProperty(el          , name        , value         ) {
    unsupported(`properties (.${name}, ${typeof value}, ${String(el === null)})`);
  }

  /**
   * The whole text content of a raw-text element (`<textarea>`, `<title>`, …).
   */
  setContent(el          , text        ) {
    unsupported(`raw text (${JSON.stringify(text)}, ${String(el === null)})`);
  }

  /**
   * The options a handler value carries, or null for a plain handler.
   */
  listenerOptions(handler         )                         {
    return handler === null ? null : null;
  }

  /**
   * @param binding the engine's binding; calling its `handleEvent(event)` runs the handler
   */
  addListener(el          , name        , binding              , options                        ) {
    unsupported(`listeners (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  removeListener(el          , name        , binding              , options                        ) {
    unsupported(`listener removal (@${name}, ${String(binding === null)}, ${String(options === null)}, ${String(el === null)})`);
  }

  /**
   * Invoke a handler that is not a function (a `handleEvent` object, say).
   */
  invokeListener(handler         , event         )          {
    return unsupported(`object handlers (${typeof handler}, ${typeof event})`);
  }

  /**
   * Parse markup into a fragment, for `unsafeHTML`.
   */
  parseMarkup(markup        )           {
    return unsupported(`unsafeHTML (${String(markup.length)} chars)`);
  }

  /**
   * The part for a `<slot>` element, when the host projects light children.
   */
  createSlotPart(spec          , el          , owner                    )       {
    return unsupported(`slots (${String(spec.valueIndex)}, ${String(el === null)}, ${String(owner === undefined)})`);
  }

  /**
   * Whether a template may use this tag.
   */
  knownTag(tag        )          {
    return tag.length > 0;
  }

  /**
   * Whether an element of `tag` takes a prop or attribute named `name`.
   */
  knownProp(tag        , name        )          {
    return tag.length > 0 && name.length > 0;
  }

  /**
   * Run the view queue's flush once, on the host's next frame.
   */
  scheduleFlush(flush            ) {
    unsupported(`frame scheduling (${String(flush === null)})`);
  }

  /**
   * Report an error an update threw, without unwinding the flush.
   */
  reportError(error         ) {
    console.error(error);
  }
}

let host = new Host();

/** The installed host. */
export const currentHost = () => host;

export const setHost = (next      ) => {
  host = next;
};
