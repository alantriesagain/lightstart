/**
 * @bootstrapp/light/controller: defineController
 * A controller is a named piece of app state and the methods that change it:
 * state shared at runtime by every component that uses it (code shared at
 * definition time is a mixin). There is one per name, made the first time
 * anything reaches it; `dispose()` retires it and the next reach makes a fresh
 * one. `defineController` answers that controller itself, a handle that builds
 * the instance on first reach and forwards every declared prop and member,
 * and the instance's `$` members, to it.
 */

import { normalizeProperties } from "../types/index.js";
import { createStore } from "../signals/store.ts";
import { assertDefinitionKeys, composeDefinition, isThenable } from "../view/definition.js";
import { acceptsOption, bindProperty, getAdapter, registerAdapter, registerLazyAdapter, unregisterAdapter } from "./sync.js";
import { tracked } from "./config.js";

/** @import { ControllerDefinition, ControllerHandle, ControllerInstance, SyncProp } from "./types.ts" */

const DEFINITION_KEYS = ["name", "props", "sync", "mixins", "connected", "disconnected"];
const SYNC_OPTIONS = new Set(["to", "key", "scope", "query", "dependsOn"]);

const HANDLE_KEYS = new Set(["definition", "has", "dispose"]);
const RESERVED = new Set([...HANDLE_KEYS, "create", "get"]);
const INSTANCE_KEYS = ["$name", "$state", "$sync", "$queries", "$own", "$attach"];
/** @type {Record<string, string>} */
const RETIRED = {
  create: "the controller is made on first reach, and dispose() resets it",
  get: "the handle is the controller; read its members directly",
  $dispose: "call dispose() on the handle",
};

/** @type {WeakMap<object, { named: boolean, register(): void }>} */
const handles = new WeakMap();

/** @param {unknown} entry */
const isLongForm = (entry) =>
  Boolean(entry) && typeof entry === "object" && Object.getPrototypeOf(entry) === Object.prototype && Object.hasOwn(/** @type {object} */ (entry), "to");

/**
 * Fold a definition's `sync` block into its properties. An entry names a
 * declared property and its target (an adapter or controller name, a store, a
 * signal, a controller, a target a sync binder claims, or a thunk answering
 * one), or the long
 * form `{ to, key?, scope?, query?, dependsOn? }`; either becomes the
 * property's sync options, which is all the binding reads.
 * @param {string} name
 * @param {Record<string, unknown> | undefined} block
 * @param {Record<string, SyncProp>} properties
 * @param {Record<string, unknown>} definition
 */
const withSyncBlock = (name, block, properties, definition) => {
  if (!block) return properties;
  const out = { ...properties };
  for (const [prop, entry] of Object.entries(block)) {
    if (!Object.hasOwn(out, prop))
      throw new Error(Object.hasOwn(definition, prop)
        ? `Controller "${name}": sync entry "${prop}" names a member; only a declared property binds`
        : `Controller "${name}": sync entry "${prop}" names no declared property; add "${prop}" to props`);
    const options = isLongForm(entry) ? /** @type {Record<string, unknown>} */ (entry) : { to: entry };
    for (const key of Object.keys(options))
      if (!SYNC_OPTIONS.has(key))
        throw new Error(`Controller "${name}": sync entry "${prop}" has an unknown option "${key}"; an entry takes to, key, scope, query and dependsOn`);
    const { to, ...rest } = options;
    out[prop] = { ...out[prop], ...rest, sync: to };
  }
  return out;
};

/**
 * A non-function member is written straight onto the instance, so an `[]`,
 * `{}`, `Map` or `Set` in the definition would be ONE object every instance
 * shares; the instance made after a `dispose()` would inherit the retired
 * one's contents. The declaration is a default, so a mutable collection is
 * copied. Anything else (null, a number, a frozen table, a class instance the
 * author means to share) is assigned as-is.
 * @param {unknown} member
 */
const freshCopy = (member) => {
  if (Array.isArray(member)) return [...member];
  if (member instanceof Map) return new Map(member);
  if (member instanceof Set) return new Set(member);
  if (member && Object.getPrototypeOf(member) === Object.prototype) return { ...member };
  return member;
};

/**
 * Typed identity wrapper for a controller definition fragment, the thing a
 * controller lists under `mixins: [...]`. Runtime: the same object. Type-level:
 * `this` inside the fragment's methods sees the fragment's own properties and
 * members typed, the `$`-prefixed instance members, and everything else loose,
 * since the host it lands on is not known here. A fragment that takes options
 * is a function returning one of these. To type `this` as the host precisely,
 * wrap the literal in a `satisfies` JSDoc cast naming the generated interface,
 * `ThisType<import("./types.ts").ControllerInstance & YourController>`.
 *
 * @template {Record<string, unknown>} D
 * @template {Record<string, import("../types/types.ts").PropertyDeclaration>} [P={}]
 * @param {D & { props?: P } & ThisType<import("./types.ts").PropsToThis<P> & Omit<D, import("./types.ts").ControllerDefinitionKey> & ControllerInstance & Record<string, any>>} definition
 * @returns {D & { props?: P }}
 */
export const defineMixin = (definition) => definition;

/**
 * Define a controller and answer it. `this` inside methods and lifecycle hooks
 * is `PropsToThis<P & MixinProps<M>> & Omit<D, ControllerDefinitionKey> & MixinMembers<M> & ControllerInstance`:
 * declared reactive props, own and from mixins (`this.month: string`), sibling
 * members declared on the literal and on the mixins, and the `$` members every
 * instance carries. Fragments listed under `mixins: [...]` fold in first
 * (`composeDefinition`), the definition's own keys win a collision, and
 * lifecycle hooks chain mixin-first.
 *
 * The answer is the controller's handle, a frozen object that forwards every
 * declared prop and member, and the instance's `$` members, to the instance,
 * building it on first reach; a key the definition does not declare is not on
 * the handle, and writing one throws. `definition`, `has()` (whether one is
 * built, without building it), `dispose()` and `$ready` answer from the handle.
 * `dispose()` runs `disconnected()` while the subscriptions the instance owns
 * are still live, then drains every owned teardown; the retiring instance
 * stays reachable until an async `disconnected()` settles, so the code inside
 * that teardown still finds the controller it is leaving. `$ready` means a
 * live instance that has finished connecting: read during a teardown, it waits
 * for the teardown and then for the instance built after it, whose
 * `connected()` also waits, so an outgoing detach cannot undo an incoming
 * attach.
 *
 * @template {Record<string, import("../types/types.ts").PropertyDeclaration>} P
 * @template {Record<string, unknown> & { sync?: import("./types.ts").SyncBlock<P & import("./types.ts").MixinProps<M>> }} D
 * @template {readonly Record<string, unknown>[]} [M=[]]
 * @param {D & { name: string, props?: P, sync?: import("./types.ts").SyncBlock<P & import("./types.ts").MixinProps<M>>, mixins?: M } & ThisType<import("./types.ts").PropsToThis<P & import("./types.ts").MixinProps<M>> & Omit<D, import("./types.ts").ControllerDefinitionKey> & import("./types.ts").MixinMembers<M, import("./types.ts").ControllerDefinitionKey> & ControllerInstance>} rawDefinition
 * @returns {ControllerHandle<P & import("./types.ts").MixinProps<M>, D & import("./types.ts").MixinMembers<M, import("./types.ts").ControllerDefinitionKey>>}
 */
export const defineController = (rawDefinition) => {
  const definition = /** @type {ControllerDefinition} */ (composeDefinition(rawDefinition));
  const { name, props: declared, connected, disconnected } = definition;
  if (!name || typeof name !== "string") throw new Error("defineController needs a string `name`.");
  if ("adapter" in definition) throw new Error(`Controller "${name}": adapter: is gone; every registered controller is a sync target by its name`);
  const descriptors = /** @type {Record<string, SyncProp>} */ (normalizeProperties(declared ?? {}));
  for (const [key, prop] of Object.entries(descriptors)) {
    if (prop.reactive === false)
      throw new Error(`Controller "${name}": property "${key}" is reactive: false; a plain field is a member, ${key}: /** @type {T} */ (value)`);
    const option = [...SYNC_OPTIONS, "sync"].find((o) => o !== "to" && prop[o] !== undefined);
    if (option)
      throw new Error(`Controller "${name}": property "${key}" declares ${option}: in its descriptor; bind it in the definition's sync block`);
  }
  const properties = withSyncBlock(name, definition.sync, descriptors, definition);
  assertDefinitionKeys(definition, `Controller "${name}"`, DEFINITION_KEYS);
  for (const key of [...Object.keys(definition), ...Object.keys(properties)])
    if (RESERVED.has(key))
      throw new Error(`Controller "${name}": "${key}" is reserved by the controller's handle (definition, has, dispose; create and get are retired); rename it`);
  /** @type {Record<string, PropertyDescriptor>} */
  const memberDescs = {};
  for (const key of Object.keys(definition))
    if (!DEFINITION_KEYS.includes(key))
      memberDescs[key] = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(definition, key));

  for (const key of Object.keys(properties))
    for (const option of ["query", "dependsOn"])
      if (properties[key][option] && !acceptsOption(properties[key].sync, option))
        throw new Error(`Controller "${name}": property "${key}" declares ${option}: for a target that takes none; ${option} needs a target a sync binder reads it for (a model), or a thunk answering one.`);

  /** @param {(instance: ControllerInstance) => void} adopt @param {Promise<void>} [after] */
  const make = (adopt, after) => {
    const defs = Object.fromEntries(Object.entries(properties)
      .map(([key, prop]) => [key, { default: prop.defaultValue, pack: prop.pack, unpack: prop.unpack }]));
    const store = createStore(defs, { name, accessors: false });

    /** @type {Array<() => void>} */
    const teardowns = [];

    /** @type {ControllerInstance} */
    const instance = /** @type {any} */ ({
      $name: name,
      $state: store,
      $sync: store.$sync,
      $queries: {},
      $own: (/** @type {(() => void) | Array<(() => void) | null | undefined> | null | undefined} */ teardown) => {
        for (const one of Array.isArray(teardown) ? teardown : [teardown])
          if (one) teardowns.push(one);
        return teardown;
      },
      $attach: (/** @type {{ $requestUpdate(): unknown }} */ host) => {
        const offs = store.keys().map((key) => store.subscribe(key, () => host.$requestUpdate()));
        return () => offs.forEach((off) => off());
      },
      $dispose: () => {
        const drain = () => {
          for (const teardown of teardowns.splice(0))
            try {
              teardown();
            } catch (error) {
              console.error(`[controller] teardown failed in "${name}":`, error);
            }
        };
        const result = /** @type {unknown} */ (typeof disconnected === "function" ? disconnected.call(instance) : undefined);
        if (!isThenable(result)) return void drain();
        return /** @type {Promise<unknown>} */ (result).then(drain, (error) => {
          drain();
          throw error;
        });
      },
    });

    const slots = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (instance));
    for (const key of Object.keys(properties))
      Object.defineProperty(instance, key, {
        get: () => store.get(key),
        set: (value) => store.set(key, value),
        enumerable: true,
      });

    for (const [key, desc] of Object.entries(memberDescs))
      if (desc.get || desc.set) Object.defineProperty(instance, key, { ...desc, enumerable: true });
      else slots[key] = typeof desc.value === "function" ? desc.value.bind(instance) : freshCopy(desc.value);

    /** @type {Promise<void>[]} */
    const loads = [];
    for (const [key, prop] of Object.entries(properties)) {
      if (!prop.sync) continue;
      const { unbind, loaded } = bindProperty({ store, key, prop, host: instance });
      instance.$own(unbind);
      if (loaded) loads.push(loaded);
    }

    adopt(instance);
    const start = () => (typeof connected === "function" ? connected.call(instance) : undefined);
    const started = after ? after.then(start) : start();
    const pending = [...loads, ...(isThenable(started) ? [/** @type {Promise<unknown>} */ (/** @type {unknown} */ (started))] : [])];
    instance.$ready = pending.length
      ? tracked(Promise.all(pending).then(() => undefined), `controller:${name}`)
      : Promise.resolve();
    return instance;
  };

  /** @type {ControllerInstance | null} */
  let current = null;
  /** @type {ControllerInstance | null} */
  let retiring = null;
  /** @type {Promise<void> | null} */
  let teardown = null;
  let registered = false;

  const build = () => {
    try {
      const made = make((adopted) => (current = adopted), teardown ?? undefined);
      if (registered) registerAdapter(name, made);
      return made;
    } catch (error) {
      current = null;
      throw error;
    }
  };
  const instance = () => current ?? retiring ?? build();
  const arm = () => registerLazyAdapter(name, () => (current ? registerAdapter(name, current) : build()));

  const own = {
    definition,
    has: () => Boolean(current ?? retiring),
    dispose: () => {
      const retired = current;
      if (!retired) return;
      current = null;
      retiring = retired;
      if (registered) {
        unregisterAdapter(name);
        arm();
      }
      const clear = () => {
        if (retiring === retired) retiring = null;
      };
      const done = retired.$dispose();
      if (!isThenable(done)) return void clear();
      const settled = /** @type {Promise<void>} */ (done);
      settled.then(clear, clear);
      const gate = Promise.all([teardown, settled]).then(() => {}, () => {});
      teardown = gate;
      gate.then(() => {
        if (teardown === gate) teardown = null;
      });
      return settled;
    },
  };

  const handle = /** @type {Record<string, unknown>} */ (own);
  for (const key of [...Object.keys(properties), ...Object.keys(memberDescs), ...INSTANCE_KEYS])
    Object.defineProperty(handle, key, {
      get: () => /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (instance()))[key],
      set: (value) => {
        /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (instance()))[key] = value;
      },
    });
  Object.defineProperty(handle, "$ready", { get: () => Promise.resolve(teardown).then(() => instance().$ready) });
  for (const [key, why] of Object.entries(RETIRED))
    Object.defineProperty(handle, key, {
      get: () => {
        throw new Error(`Controller "${name}": .${key} is gone; ${why}`);
      },
    });
  Object.freeze(handle);

  handles.set(handle, {
    get named() {
      return registered;
    },
    register() {
      registered = true;
      arm();
    },
  });
  return /** @type {ControllerHandle<P & import("./types.ts").MixinProps<M>, D & import("./types.ts").MixinMembers<M, import("./types.ts").ControllerDefinitionKey>>} */ (/** @type {unknown} */ (handle));
};

/**
 * Make each controller a sync target by its name: `sync: "<name>"` binds to
 * it, building it on the first binding, and after `dispose()` a later binding
 * reaches the next instance. A name a sync adapter already holds is refused,
 * since one of the two would answer for both; a controller named twice is
 * named once.
 *
 * @param {ControllerHandle[]} controllers
 */
export const nameControllers = (controllers) => {
  for (const handle of controllers) {
    const entry = handles.get(handle);
    if (!entry || entry.named) continue;
    const { name } = handle.definition;
    if (getAdapter(name)) throw new Error(`Controller "${name}" has the name of the sync adapter "${name}"; rename the controller`);
    entry.register();
  }
};
