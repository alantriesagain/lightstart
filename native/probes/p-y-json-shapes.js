/**
 * @file Probe Y: the shapes a bridge dispatcher needs. A nested literal tree typed `unknown`
 * stringified, a 5 MB document parsed and narrowed, a class instance copied into a record before
 * stringifying (a class instance itself cannot be stringified natively), and a `Map<string, Handler>`
 * whose handlers take a payload and a `Meta` instance and answer a Promise, invoked sequentially
 * through an async `dispatch`, including an async arrow and a fallback field (assigned through a
 * const typed with the handler type, since an arrow assigned straight to a nullable function field
 * is not inferred against it; and narrowed before the map's result is combined with it, since `??`
 * across two unions has no layout).
 */

export class Meta {
  /**
   * @param {string} type
   * @param {string} eventId
   * @param {string} connectionId
   */
  constructor(type, eventId, connectionId) {
    this.type = type;
    this.eventId = eventId;
    this.connectionId = connectionId;
  }
}

/** @typedef {(payload: unknown, meta: Meta) => Promise<unknown>} Handler */

export class Dispatcher {
  constructor() {
    /** @type {Map<string, Handler>} */
    this.handlers = new Map();
    /** @type {Handler | null} */
    this.fallback = null;
  }

  /**
   * @param {string} type
   * @param {Handler} handler
   */
  on(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * @param {string} raw
   * @param {string} connectionId
   * @returns {Promise<string>}
   */
  async dispatch(raw, connectionId) {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "bad";
    const record = /** @type {Record<string, unknown>} */ (parsed);
    const type = typeof record.type === "string" ? record.type : "";
    const eventId = typeof record.eventId === "string" ? record.eventId : "";
    const found = this.handlers.get(type);
    const handler = found !== undefined ? found : this.fallback;
    if (handler === null) return "none";
    try {
      const result = await handler(record.payload, new Meta(type, eventId, connectionId));
      /** @type {unknown} */
      const reply = { eventId, payload: result };
      return JSON.stringify(reply);
    } catch (err) {
      /** @type {unknown} */
      const reply = { eventId, error: err instanceof Error ? err.message : "error", detail: { name: err instanceof Error ? err.name : "" } };
      return JSON.stringify(reply);
    }
  }
}

/** @type {unknown} */
const tree = { name: "root", path: "", isDirectory: true, children: [{ name: "a", path: "a", isDirectory: false }, { name: "b", path: "b", isDirectory: true, children: [] }] };
console.log("tree", JSON.stringify(tree));
const meta = new Meta("T", "e1", "win-1");
/** @type {unknown} */
const metaRecord = { type: meta.type, eventId: meta.eventId, connectionId: meta.connectionId };
console.log("meta", JSON.stringify(metaRecord));

/** @type {unknown[]} */
const items = [];
for (let i = 0; i < 120000; i++) items.push({ id: i, name: "item-" + String(i), on: i % 2 === 0 });
const big = JSON.stringify(items);
const back = JSON.parse(big);
console.log("big", big.length > 5000000, Array.isArray(back) ? back.length : -1);

const d = new Dispatcher();
d.on("ECHO", (payload, meta) => {
  /** @type {unknown} */
  const value = { echoed: payload, via: meta.type, conn: meta.connectionId };
  return Promise.resolve(value);
});
d.on("ASYNC", async (payload, meta) => {
  await Promise.resolve();
  /** @type {unknown} */
  const value = [meta.eventId, typeof payload];
  return value;
});
d.on("THROW", () => Promise.reject(new Error("boom")));
/** @type {Handler} */
const unsupported = (payload, meta) => Promise.reject(new Error("unsupported: " + meta.type));
d.fallback = unsupported;

const run = async () => {
  console.log(await d.dispatch(JSON.stringify({ type: "ECHO", payload: { a: 1 }, eventId: "r1" }), "win-1"));
  console.log(await d.dispatch(JSON.stringify({ type: "ASYNC", payload: "s", eventId: "r2" }), "win-1"));
  console.log(await d.dispatch(JSON.stringify({ type: "THROW", payload: null, eventId: "r3" }), "win-1"));
  console.log(await d.dispatch(JSON.stringify({ type: "NOPE:NOPE", payload: {}, eventId: "r4" }), "win-1"));
  console.log(await d.dispatch("[1,2]", "win-1"));
  console.log("done");
};
run();
