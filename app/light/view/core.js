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
import { Reactive, effect, swapCurrent } from "../signals/index.js";

configure({ effect });

class Config {
  track                                          ;
  tracked         ;
  wrap                                                 ;
  settle                                      ;
  translate                                                                       ;
  dev         ;

  constructor() {
    this.track = () => {};
    this.tracked = false;
    this.wrap = () => {};
    this.settle = undefined;
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
 */
export const configureView = (options                                  ) => {
  if (options.track !== undefined) {
    config.track = options.track;
    config.tracked = true;
  }
  if (options.wrap !== undefined) config.wrap = options.wrap;
  if (options.settle !== undefined) config.settle = options.settle;
  if (options.translate !== undefined) config.translate = options.translate;
  if (options.dev !== undefined) config.dev = options.dev;
};

/**
 * Hand async work an element waits on to the host, so a host that waits for
 * a quiet page counts it. Answers the same promise.
 */
export const trackWork =    (work            , label        )             => {
  config.wrap(work, label);
  return work;
};

/**
 * The host's text for `key`, or undefined when it has none, so a component
 * falls back to its own.
 */
export const translate = (key        , params                          )                     => config.translate(key, params);

let queue             = [];
let flushing                    = null;
let flushScheduled = false;

function depthOf(node         ) {
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
    const depths                        = new Map();
    for (const view of batch) depths.set(view, depthOf(view.$node));
    batch.sort(
      (a          , b          ) => (depths.get(a) ?? 0) - (depths.get(b) ?? 0),
    );
  }
  const updated                = new Set();
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

function enqueueUpdate(view          ) {
  if (flushing !== null) flushing.push(view);
  else {
    queue.push(view);
    scheduleFlush();
  }
}

class RenderNode extends Reactive {
  owner          ;

  constructor(owner          ) {
    super();
    this.owner = owner;
  }

  _run() {
    this.owner.$enqueueUpdate();
  }
}

/**
 * The methods of the cycle itself, the ones a host takes from ViewCore as
 * they are; everything else on it is the host's to answer.
 */
export const CORE_METHODS = ["$requestUpdate", "$enqueueUpdate", "$whenUpdated", "$schedule", "$flushUpdate", "$performUpdate", "$shouldUpdate", "$update", "$own", "$attach", "$detach", "$setProp"];

/**
 * One component's update cycle. A host answers `$node`, `$connected`,
 * `$label`, `$tracked`, `$hasChanged`, `$setProp`, `$hook`, `$render` and
 * `$commit`; the cycle itself (`$requestUpdate` through `$flushUpdate`, the
 * hooks' order, teardowns) is the same on every host, and
 * `await view.$requestUpdate()` resolves once the update ran.
 */
export class ViewCore {
  $hasUpdated = false;
  $forceNextUpdate = false;
  $changedProps                       = new Map();
  $updatePending = false;
  $updatePromise                       = null;
  $resolveUpdate                      = null;
  $settleDone                      = null;
  $teardowns                           = null;
  $renderNode                    = null;

  /** @returns the host node whose depth orders this view among the ones flushed with it */
  get $node()          {
    return null;
  }

  /** @returns whether the view is in a tree, so an update renders */
  get $connected()          {
    return currentHost().isConnected(this.$node);
  }

  /** @returns what names this view's work to the host's tracker */
  get $label()         {
    return "view";
  }

  /** @returns whether render runs under a reactive, so a signal it reads re-renders the view */
  get $tracked()          {
    return true;
  }

  /**
   * @returns whether the property's value differs from the one recorded when it changed
   */
  $hasChanged(_key        , _oldValue         )          {
    return true;
  }

  /**
   * @returns whether the view took a prop handed to it by name: a host routes an attribute or property binding on the element a view owns to the view
   */
  $setProp(_name        , _value         )          {
    return false;
  }

  /**
   * @param _name one of connected, disconnected, willUpdate, firstUpdated, updated
   * @param _changedProps the update's changed properties, for the update hooks
   */
  $hook(_name        , _changedProps                             ) {}

  /** @returns what the component's render answers */
  $render()          {
    return null;
  }

  /** @param _value what render answered, to commit into the component's container */
  $commit(_value         ) {}

  /**
   * Record a changed property (or, with no key, force the next render) and
   * schedule the view's update. Answers the promise of the pending update;
   * inside a running update, that update's own promise.
   */
  $requestUpdate(key         , oldValue          )                {
    this.$enqueueUpdate(key, oldValue);
    return this.$whenUpdated();
  }

  /**
   * `$requestUpdate` without the promise: what the engine's own writes call,
   * so an update nobody waits for makes none.
   */
  $enqueueUpdate(key         , oldValue          ) {
    if (key) this.$changedProps.set(key, oldValue);
    else this.$forceNextUpdate = true;
    this.$schedule();
  }

  /** Answers the promise of the pending update, made on the first ask; resolved already when none is pending. */
  $whenUpdated()                {
    if (!this.$updatePending) return Promise.resolve();
    if (this.$updatePromise === null)
      this.$updatePromise = new Promise((resolve) => {
        this.$resolveUpdate = resolve;
      });
    return this.$updatePromise;
  }

  $schedule() {
    if (this.$updatePending) return;
    this.$updatePending = true;
    this.$settleDone = config.tracked ? config.track("view:" + this.$label) ?? null : null;
    enqueueUpdate(this);
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
    this.$updatePending = false;
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
   */
  $performUpdate(forceUpdate         ) {
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
   */
  $shouldUpdate(changedProps                      , forceUpdate         ) {
    if (!this.$hasUpdated || forceUpdate) return true;
    const unchanged           = [];
    for (const [key, oldValue] of changedProps) if (!this.$hasChanged(key, oldValue)) unchanged.push(key);
    for (const key of unchanged) changedProps.delete(key);
    return changedProps.size > 0;
  }

  $update() {
    if (!this.$tracked) {
      this.$commit(this.$render());
      return;
    }
    if (this.$renderNode === null) this.$renderNode = new RenderNode(this);
    const node = this.$renderNode;
    node._cleanup();
    const prev = swapCurrent(node);
    let value         ;
    try {
      value = this.$render();
    } finally {
      swapCurrent(prev);
    }
    this.$commit(value);
  }

  /**
   * Hold a teardown until disconnect: any unsubscribe function, run when the
   * view leaves its tree, so subscriptions made on connect need no
   * bookkeeping.
   */
  $own(teardown            ) {
    if (this.$teardowns === null) this.$teardowns = [];
    this.$teardowns.push(teardown);
  }

  $attach() {
    this.$hook("connected", null);
    this.$enqueueUpdate();
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
