/**
 * @bootstrapp/light/view/definition.js: definition composition
 * The one merge primitive for definition-shaped citizens (components,
 * controllers, extensions): props, events and a controller's sync block union
 * (incoming wins), lifecycle hooks
 * chain (existing runs first, an async hook on either side is awaited),
 * everything else copies property descriptors
 * (NOT spread): definitions legitimately declare getters and spread would
 * invoke them at merge time with the wrong `this`. DOM-free on purpose: views,
 * controllers, and the extensions kernel all compose through it.
 */

/** @import { DefinitionFragment } from "./primitives.ts" */

export const LIFECYCLE_HOOKS = ["connected", "disconnected", "firstUpdated", "updated", "willUpdate"];

/** @param {unknown} value */
export const isThenable = (value) => Boolean(value) && typeof (/** @type {{ then?: unknown }} */ (value)).then === "function";

/**
 * Whether `key` belongs to the framework: every member the engine installs on
 * `this` (`$state`, `$own`, `$emit`, `$ready`, ...) starts with `$`, so a
 * definition may not declare one.
 * @param {string} key
 */
export const isFrameworkKey = (key) => key.startsWith("$");

/** @param {unknown} value @returns {Record<string, unknown>} */
const fieldsOf = (value) => (value && typeof value === "object" ? /** @type {Record<string, unknown>} */ (value) : {});

/**
 * The one define-time guard shared by views, controllers and extensions: no
 * `$`-prefixed property or member, and no name declared as both a property and
 * a member. `definitionKeys` names the keys the engine consumes from the
 * definition itself (lifecycle hooks, `props`, `tag`, ...); a property may
 * share one of those names because they never land on the instance. A
 * definition still carrying `properties`, the key's old name, is refused.
 * @param {object} definition
 * @param {string} label
 * @param {Iterable<string>} definitionKeys
 */
export const assertDefinitionKeys = (definition, label, definitionKeys) => {
  if ("properties" in definition) throw new Error(`${label}: "properties" is not a definition key; declare reactive properties under "props"`);
  const consumed = new Set([...definitionKeys]);
  const props = fieldsOf(fieldsOf(definition).props);
  for (const key of Object.keys(props)) {
    if (isFrameworkKey(key)) throw new Error(`${label}: property "${key}" uses the framework's $ prefix; rename it`);
    if (key in definition && !consumed.has(key)) throw new Error(`${label}: "${key}" is declared as both a property and a member`);
  }
  for (const key of Object.keys(definition))
    if (isFrameworkKey(key)) throw new Error(`${label}: member "${key}" uses the framework's $ prefix; rename it`);
};

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} incoming
 * @param {readonly string[]} [hooks] the keys chained instead of overridden
 */
export const mergeDefinitions = (current, incoming, hooks = LIFECYCLE_HOOKS) => {
  /** @type {Record<string, unknown>} */
  const merged = {};
  for (const obj of [current, incoming]) {
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (desc) Object.defineProperty(merged, key, desc);
    }
  }
  if (current.props || incoming.props)
    merged.props = { ...fieldsOf(current.props), ...fieldsOf(incoming.props) };
  if (current.events || incoming.events)
    merged.events = { ...fieldsOf(current.events), ...fieldsOf(incoming.events) };
  if (current.sync || incoming.sync)
    merged.sync = { ...fieldsOf(current.sync), ...fieldsOf(incoming.sync) };
  for (const hook of hooks) {
    const before = current[hook];
    const after = incoming[hook];
    if (typeof before === "function" && typeof after === "function")
      merged[hook] = /** @this {unknown} @param {...unknown} args */ function chainedHook(...args) {
        const first = /** @type {(...args: unknown[]) => unknown} */ (before).apply(this, args);
        const second = /** @type {(...args: unknown[]) => unknown} */ (after).apply(this, args);
        if (!isThenable(first)) return second;
        if (!isThenable(second)) return first;
        return Promise.all([first, second]).then(() => undefined);
      };
  }
  return merged;
};

/**
 * Fold a definition's `mixins` into it: each fragment (recursively composed
 * when it carries mixins of its own) is merged in order, then the
 * definition's own keys. Props, events and members union, the later
 * side wins a collision, lifecycle hooks chain in order and an async hook on
 * either side is awaited by the chained hook. A definition without mixins is
 * returned as is.
 *
 * @template {{ mixins?: readonly object[] }} D
 * @param {D} definition
 * @param {readonly string[]} [hooks] the keys chained instead of overridden
 * @returns {D}
 */
export const composeDefinition = (definition, hooks = LIFECYCLE_HOOKS) => {
  const { mixins } = definition;
  if (!mixins?.length) return definition;
  /** @type {Record<string, unknown>} */
  const own = {};
  for (const key of Object.keys(definition))
    if (key !== "mixins") Object.defineProperty(own, key, /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(definition, key)));
  /** @type {Record<string, unknown>} */
  let composed = {};
  for (const mixin of mixins) composed = mergeDefinitions(composed, composeDefinition(/** @type {DefinitionFragment} */ (mixin), hooks), hooks);
  return /** @type {D} */ (mergeDefinitions(composed, own, hooks));
};
