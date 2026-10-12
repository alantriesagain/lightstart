/**
 * @bootstrapp/light/view/core: the host-neutral half of a view. A ViewCore
 * owns one component's update cycle (the changed properties, the promise of
 * the pending update, the lifecycle hooks, the teardowns held until
 * disconnect, a render tracked for the signals it reads) and the module owns
 * the queue that flushes every dirty view once per frame, parents first. A
 * host either subclasses it or copies its methods onto its own element
 * class, and answers where the instance sits in its tree and how what
 * render() returned is committed; the engine's configuration lives here as
 * well.
 */
import { currentHost } from "../html/host.js";
import { configure } from "../html/reactive.js";
import { Reactive, effect, withCurrent } from "../signals/index.js";

configure({ effect });

class Config {
  constructor() {
    /** @type {(label: string) => ((() => void) | void)} */
    this.track = () => {};
    /** @type {(work: Promise<unknown>, label: string) => void} */
    this.wrap = () => {};
    /** @type {(() => Promise<unknown>) | undefined} */
    this.settle = undefined;
    /** @type {(key: string, params?: Record<string, unknown>) => string | undefined} */
    this.translate = () => undefined;
    this.dev = true;
  }
}

/** The engine's configuration, as `configureView` left it. */
export const config = new Config();

/**
 * Hand the engine what its host knows: `track(label)` is called when an
 * element's update is scheduled and answers the function to call once it
 * ran; `wrap(promise, label)` receives every async lifecycle hook, plugin
 * init and the work components pass to `trackWork`; `settle()` resolves when
 * a served region the client cannot adopt may be rendered over; `translate`
 * answers the host's text for a key; `dev` turns on diagnostics.
 * @param {Partial<Config>} options
 */
export const configureView = (options) => {
  if (options.track !== undefined) config.track = options.track;
  if (options.wrap !== undefined) config.wrap = options.wrap;
  if (options.settle !== undefined) config.settle = options.settle;
  if (options.translate !== undefined) config.translate = options.translate;
  if (options.dev !== undefined) config.dev = options.dev;
};

/**
 * Hand async work an element waits on to the host, so a host that waits for
 * a quiet page counts it. Answers the same promise.
 * @template T
 * @param {Promise<T>} work
 * @param {string} label
 * @returns {Promise<T>}
 */
export const trackWork = (work, label) => {
  config.wrap(work, label);
  return work;
};

/**
 * The host's text for `key`, or undefined when it has none, so a component
 * falls back to its own.
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string | undefined}
 */
export const translate = (key, params) => config.translate(key, params);

/** @type {ViewCore[]} */
let queue = [];
/** @type {ViewCore[] | null} */
let flushing = null;
let flushScheduled = false;

/** @param {unknown} node */
function depthOf(node) {
  const host = currentHost();
  let depth = 0;
  for (let parent = host.parentOf(node); parent !== null; parent = host.parentOf(parent)) depth++;
  return depth;
}

function flushUpdates() {
  if (!flushScheduled) return;
  flushScheduled = false;
  const batch = queue;
  queue = [];
  if (batch.length > 1) {
    /** @type {Map<ViewCore, number>} */
    const depths = new Map();
    for (const view of batch) depths.set(view, depthOf(view.$node));
    batch.sort(
      /**
       * @param {ViewCore} a
       * @param {ViewCore} b
       */
      (a, b) => (depths.get(a) ?? 0) - (depths.get(b) ?? 0),
    );
  }
  /** @type {Set<ViewCore>} */
  const updated = new Set();
  flushing = batch;
  try {
    for (const view of batch)
      if (updated.has(view)) queue.push(view);
      else {
        updated.add(view);
        view.$flushUpdate();
      }
  } finally {
    flushing = null;
  }
  if (queue.length > 0) scheduleFlush();
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  currentHost().scheduleFlush(flushUpdates);
}

/** @param {ViewCore} view */
function enqueueUpdate(view) {
  if (flushing !== null) flushing.push(view);
  else {
    queue.push(view);
    scheduleFlush();
  }
}

class RenderNode extends Reactive {
  /** @param {ViewCore} owner */
  constructor(owner) {
    super();
    this.owner = owner;
  }

  _run() {
    this.owner.$requestUpdate();
  }
}

/**
 * The methods of the cycle itself, the ones a host takes from ViewCore as
 * they are; everything else on it is the host's to answer.
 */
export const CORE_METHODS = ["$requestUpdate", "$schedule", "$flushUpdate", "$performUpdate", "$shouldUpdate", "$update", "$own", "$attach", "$detach"];

/**
 * One component's update cycle. A host answers `$node`, `$connected`,
 * `$label`, `$tracked`, `$hasChanged`, `$hook`, `$render` and `$commit`;
 * the cycle itself (`$requestUpdate` through `$flushUpdate`, the hooks'
 * order, teardowns) is the same on every host, and
 * `await view.$requestUpdate()` resolves once the update ran.
 */
export class ViewCore {
  $hasUpdated = false;
  $forceNextUpdate = false;
  /** @type {Map<string, unknown>} */
  $changedProps = new Map();
  /** @type {Promise<void> | null} */
  $updatePromise = null;
  /** @type {(() => void) | null} */
  $resolveUpdate = null;
  /** @type {(() => void) | null} */
  $settleDone = null;
  /** @type {Array<() => void> | null} */
  $teardowns = null;
  /** @type {RenderNode | null} */
  $renderNode = null;

  /** @returns {unknown} the host node whose depth orders this view among the ones flushed with it */
  get $node() {
    return null;
  }

  /** @returns {boolean} whether the view is in a tree, so an update renders */
  get $connected() {
    return currentHost().isConnected(this.$node);
  }

  /** @returns {string} what names this view's work to the host's tracker */
  get $label() {
    return "view";
  }

  /** @returns {boolean} whether render runs under a reactive, so a signal it reads re-renders the view */
  get $tracked() {
    return true;
  }

  /**
   * @param {string} _key
   * @param {unknown} _oldValue
   * @returns {boolean} whether the property's value differs from the one recorded when it changed
   */
  $hasChanged(_key, _oldValue) {
    return true;
  }

  /**
   * @param {string} _name one of connected, disconnected, willUpdate, firstUpdated, updated
   * @param {Map<string, unknown> | null} _changedProps the update's changed properties, for the update hooks
   */
  $hook(_name, _changedProps) {}

  /** @returns {unknown} what the component's render answers */
  $render() {
    return null;
  }

  /** @param {unknown} _value what render answered, to commit into the component's container */
  $commit(_value) {}

  /**
   * Record a changed property (or, with no key, force the next render) and
   * schedule the view's update. Answers the promise of the pending update;
   * inside a running update, that update's own promise.
   * @param {string} [key]
   * @param {unknown} [oldValue]
   * @returns {Promise<void>}
   */
  $requestUpdate(key, oldValue) {
    if (key) this.$changedProps.set(key, oldValue);
    else this.$forceNextUpdate = true;
    return this.$schedule();
  }

  /** @returns {Promise<void>} */
  $schedule() {
    if (this.$updatePromise !== null) return this.$updatePromise;
    this.$settleDone = config.track("view:" + this.$label) ?? null;
    this.$updatePromise = new Promise((resolve) => {
      this.$resolveUpdate = resolve;
    });
    enqueueUpdate(this);
    return this.$updatePromise;
  }

  $flushUpdate() {
    if (this.$connected) {
      const force = this.$forceNextUpdate;
      this.$forceNextUpdate = false;
      try {
        this.$performUpdate(force);
      } catch (error) {
        this.$changedProps = new Map();
        this.$forceNextUpdate = false;
        currentHost().reportError(error);
      }
    }
    const resolve = this.$resolveUpdate;
    const done = this.$settleDone;
    this.$updatePromise = null;
    this.$resolveUpdate = null;
    this.$settleDone = null;
    if (this.$connected && (this.$changedProps.size > 0 || this.$forceNextUpdate)) this.$schedule();
    if (resolve !== null) resolve();
    if (done !== null) done();
  }

  /**
   * Run one update now. Properties set in `willUpdate` belong to this update;
   * anything set from the render on (a child's teardown, `updated`) is
   * recorded for the next one.
   * @param {boolean} forceUpdate
   */
  $performUpdate(forceUpdate) {
    const changedProps = this.$changedProps;
    if (!this.$shouldUpdate(changedProps, forceUpdate)) return;
    this.$hook("willUpdate", changedProps);
    this.$changedProps = new Map();
    this.$update();
    const isFirst = !this.$hasUpdated;
    if (isFirst) this.$hasUpdated = true;
    if (isFirst) this.$hook("firstUpdated", changedProps);
    this.$hook("updated", changedProps);
  }

  /**
   * Drop the recorded keys whose value did not change; answers whether any
   * remain. A first or forced update keeps every key.
   * @param {Map<string, unknown>} changedProps
   * @param {boolean} forceUpdate
   */
  $shouldUpdate(changedProps, forceUpdate) {
    if (!this.$hasUpdated || forceUpdate) return true;
    /** @type {string[]} */
    const unchanged = [];
    for (const [key, oldValue] of changedProps) if (!this.$hasChanged(key, oldValue)) unchanged.push(key);
    for (const key of unchanged) changedProps.delete(key);
    return changedProps.size > 0;
  }

  $update() {
    /** @type {RenderNode | null} */
    let node = null;
    if (this.$tracked) {
      if (this.$renderNode === null) this.$renderNode = new RenderNode(this);
      node = this.$renderNode;
      node._cleanup();
    }
    const value = node === null ? this.$render() : withCurrent(node, () => this.$render());
    this.$commit(value);
  }

  /**
   * Hold a teardown until disconnect: any unsubscribe function, run when the
   * view leaves its tree, so subscriptions made on connect need no
   * bookkeeping.
   * @param {() => void} teardown
   */
  $own(teardown) {
    if (this.$teardowns === null) this.$teardowns = [];
    this.$teardowns.push(teardown);
  }

  $attach() {
    this.$hook("connected", null);
    this.$requestUpdate();
  }

  $detach() {
    const teardowns = this.$teardowns;
    this.$teardowns = null;
    if (teardowns !== null)
      for (const teardown of teardowns)
        try {
          teardown();
        } catch (error) {
          console.error("[view] teardown failed in <" + this.$label + ">:", error);
        }
    if (this.$renderNode !== null) this.$renderNode._cleanup();
    this.$hook("disconnected", null);
  }
}
