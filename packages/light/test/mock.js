/**
 * `node:test`'s `MockTracker`, for the browser runner. Shaped like node's:
 * `.mock.calls[i].arguments` (not `args`), `callCount()`, `mockImplementation`,
 * `mockImplementationOnce(fn, onCall)`, `restore()`.
 */

/** @import { AnyFn, LooseFn, MockCall, MockContext, MockedFn } from "./types.ts" */

/** @param {string} member @param {string} reason @param {string} remedy @returns {() => never} */
const NOT_SUPPORTED = (member, reason, remedy) => () => {
  throw new Error(`${member} is not available in the browser test runner (${reason}). ${remedy}`);
};

/** @param {AnyFn | undefined} original @param {() => void} restore @returns {MockContext} */
const createMockContext = (original, restore) => {
  /** @type {MockCall[]} */
  const calls = [];
  /** @type {AnyFn | undefined} */
  let implementation;
  /** @type {Map<number, AnyFn>} */
  const onceImplementations = new Map();

  const context = {
    calls,
    callCount: () => calls.length,
    /** @param {AnyFn} fn */
    mockImplementation(fn) { implementation = fn; },
    /** @param {AnyFn} fn @param {number} [onCall] */
    mockImplementationOnce(fn, onCall) { onceImplementations.set(onCall ?? calls.length, fn); },
    resetCalls() { calls.length = 0; },
    restore,
    /** @param {number} index */
    _implementationFor(index) { return onceImplementations.get(index) ?? implementation ?? original; },
    /** @param {MockCall} entry */
    _record(entry) { calls.push(entry); },
  };
  return context;
};

/** @param {AnyFn | undefined} original @param {() => void} restore @param {string} [name] @returns {MockedFn} */
const wrap = (original, restore, name) => {
  const target = original ?? function noop() {};
  const mock = createMockContext(original, restore);
  const fn = Object.assign(
    /** @this {unknown} @param {...never} args */
    function mocked(...args) {
      const index = mock.calls.length;
      /** @type {MockCall} */
      const entry = { arguments: args, error: undefined, result: undefined, stack: new Error(), target: undefined, this: this };
      mock._record(entry);
      const impl = mock._implementationFor(index);
      try {
        const result = impl?.apply(this, args);
        entry.result = result;
        return result;
      } catch (error) {
        entry.error = error;
        throw error;
      }
    },
    { mock },
  );
  Object.defineProperty(fn, "name", { value: name ?? target.name ?? "mocked", configurable: true });
  return fn;
};

export class MockTracker {
  /** @type {(() => void)[]} */
  #restores = [];

  /**
   * @template {AnyFn} [F=LooseFn]
   * @param {F} [original]
   * @param {F} [implementation]
   * @param {{ times?: number }} [options]
   * @returns {MockedFn<F>}
   */
  fn(original, implementation, options = {}) {
    const impl = typeof implementation === "function" ? implementation : undefined;
    const base = typeof original === "function" ? original : undefined;
    const mocked = /** @type {MockedFn<F>} */ (wrap(impl ?? base, () => {}, base?.name));
    if (impl && base) mocked.mock.mockImplementation(impl);
    if (options.times !== undefined && impl)
      for (let i = 0; i < options.times; i++) mocked.mock.mockImplementationOnce(impl, i);
    this.#restores.push(() => mocked.mock.resetCalls());
    return mocked;
  }

  /**
   * @template {AnyFn} [F=LooseFn]
   * @param {Record<string|symbol, unknown>} object
   * @param {string|symbol} methodName
   * @param {F} [implementation]
   * @param {{ getter?: boolean, setter?: boolean }} [options]
   * @returns {MockedFn<F>}
   */
  method(object, methodName, implementation, options = {}) {
    /** @type {TypedPropertyDescriptor<unknown> | undefined} */
    const descriptor = Object.getOwnPropertyDescriptor(object, methodName);
    const kind = options.getter ? "get" : options.setter ? "set" : "value";
    const original = /** @type {AnyFn | undefined} */ (descriptor ? descriptor[kind] : object[methodName]);
    const restore = () => {
      if (descriptor) Object.defineProperty(object, methodName, descriptor);
      else delete object[methodName];
    };
    const mocked = /** @type {MockedFn<F>} */ (wrap(typeof implementation === "function" ? implementation : original, restore, original?.name));

    if (kind === "value") object[methodName] = mocked;
    else Object.defineProperty(object, methodName, { ...descriptor, [kind]: mocked, configurable: true });

    this.#restores.push(restore);
    return mocked;
  }

  /** @template {AnyFn} [F=LooseFn] @param {Record<string|symbol, unknown>} object @param {string|symbol} name @param {F} [implementation] */
  getter(object, name, implementation) {
    return this.method(object, name, implementation, { getter: true });
  }

  /** @template {AnyFn} [F=LooseFn] @param {Record<string|symbol, unknown>} object @param {string|symbol} name @param {F} [implementation] */
  setter(object, name, implementation) {
    return this.method(object, name, implementation, { setter: true });
  }

  reset() {
    this.restoreAll();
    this.#restores = [];
  }

  restoreAll() {
    for (const restore of this.#restores.splice(0)) restore();
  }

  get timers() {
    return {
      enable: NOT_SUPPORTED(
        "mock.timers",
        "faking node:timers needs module-loader interception, which a browser importmap cannot do after parse",
        "Drive time explicitly: pass a clock into the unit under test, as packages/gymfluencer/lib/player-clock.js does.",
      ),
    };
  }

  module = NOT_SUPPORTED(
    "mock.module",
    "module mocking needs loader interception; an importmap is fixed when the page parses",
    "Inject the dependency, or use mock.method on the imported namespace object.",
  );
}

export const mock = new MockTracker();
export default mock;
