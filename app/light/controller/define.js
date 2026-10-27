/**
 * @lightstart/light/controller: defineController
 * A controller is a named piece of app state and the methods that change it:
 * state shared at runtime by every component that uses it (code shared at
 * definition time is a mixin). There is one per name, made the first time
 * anything reaches it; `dispose()` retires it and the next reach makes a fresh
 * one. `defineController` answers that controller itself, a handle that builds
 * the instance on first reach and forwards every declared prop and member,
 * and the instance's `$` members, to it. A non-function member is a default:
 * an array, a plain object, a `Map` or a `Set` is copied per instance, so the
 * instance made after a `dispose()` starts from the declaration; anything else
 * is assigned as it is.
 */

import { normalizeProperties } from "../types/index.js";
import { createStore } from "../signals/store.js";
import { assertDefinitionKeys, composeDefinition, isThenable } from "../view/definition.js";
import { acceptsOption, bindProperty, getAdapter, registerAdapter, registerLazyAdapter, unregisterAdapter } from "./sync.js";
import { tracked } from "./config.js";
import { Teardowns } from "./teardowns.js";
import { RecordWriter, registerWriter, writableRecord, writerOf } from "./writers.js";

                                                                                
                                                                                                                                                             

                                                                                                 

                                          

                                                                                                

                                                          

const DEFINITION_KEYS = ["name", "props", "sync", "mixins", "connected", "disconnected"];
const SYNC_OPTIONS = new Set(["to", "key", "scope", "query", "dependsOn"]);

const HANDLE_KEYS = new Set(["definition", "has", "dispose"]);
const RESERVED = new Set([...HANDLE_KEYS, "create", "get"]);
const INSTANCE_KEYS = ["$name", "$state", "$sync", "$queries", "$own", "$attach"];
const RETIRED                         = {
  create: "the controller is made on first reach, and dispose() resets it",
  get: "the handle is the controller; read its members directly",
  $dispose: "call dispose() on the handle",
};

const handles                               = new WeakMap();

const isLongForm = (entry         )                                   =>
  entry !== null && typeof entry === "object" && Object.getPrototypeOf(entry) === Object.prototype && Object.hasOwn(entry, "to");

const withSyncBlock = (name        , block                                     , properties                            , definition                         ) => {
  if (!block) return properties;
  const out = { ...properties };
  for (const [prop, entry] of Object.entries(block)) {
    if (!Object.hasOwn(out, prop))
      throw new Error(Object.hasOwn(definition, prop)
        ? `Controller "${name}": sync entry "${prop}" names a member; only a declared property binds`
        : `Controller "${name}": sync entry "${prop}" names no declared property; add "${prop}" to props`);
    const options                          = isLongForm(entry) ? entry : { to: entry };
    for (const key of Object.keys(options))
      if (!SYNC_OPTIONS.has(key))
        throw new Error(`Controller "${name}": sync entry "${prop}" has an unknown option "${key}"; an entry takes to, key, scope, query and dependsOn`);
    const { to, ...rest } = options;
    out[prop] = { ...out[prop], ...rest, sync: to };
  }
  return out;
};

const freshCopy = (member         )          => {
  if (Array.isArray(member)) return [...member];
  if (member instanceof Map) return new Map(member);
  if (member instanceof Set) return new Set(member);
  if (member && Object.getPrototypeOf(member) === Object.prototype) return { ...(member                           ) };
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
 * `ThisType<import("./types.js").ControllerInstance & YourController>`.
 */
                                                                                                                   
                                                                                                                                             
                     
export function defineMixin(definition                         )                          {
  return definition;
}

const createController = (definition                         )                          => {
  const { name, props: declared, connected, disconnected } = definition;
  if (!name || typeof name !== "string") throw new Error("defineController needs a string `name`.");
  if ("adapter" in definition) throw new Error(`Controller "${name}": adapter: is gone; every registered controller is a sync target by its name`);
  const descriptors                             = normalizeProperties((declared ?? {})                                     );
  for (const [key, prop] of Object.entries(descriptors)) {
    if (prop.reactive === false)
      throw new Error(`Controller "${name}": property "${key}" is reactive: false; a plain field is a member, ${key}: /** @type {T} */ (value)`);
    const option = [...SYNC_OPTIONS, "sync"].find((o) => o !== "to" && prop[o] !== undefined);
    if (option)
      throw new Error(`Controller "${name}": property "${key}" declares ${option}: in its descriptor; bind it in the definition's sync block`);
  }
  const properties = withSyncBlock(name, definition.sync                                       , descriptors, definition);
  assertDefinitionKeys(definition, `Controller "${name}"`, DEFINITION_KEYS);
  for (const key of [...Object.keys(definition), ...Object.keys(properties)])
    if (RESERVED.has(key))
      throw new Error(`Controller "${name}": "${key}" is reserved by the controller's handle (definition, has, dispose; create and get are retired); rename it`);
  const memberDescs                                  = new Map();
  for (const key of Object.keys(definition))
    if (!DEFINITION_KEYS.includes(key))
      memberDescs.set(key, Object.getOwnPropertyDescriptor(definition, key)                      );

  for (const key of Object.keys(properties))
    for (const option of ["query", "dependsOn"])
      if (properties[key][option] && !acceptsOption(properties[key].sync, option))
        throw new Error(`Controller "${name}": property "${key}" declares ${option}: for a target that takes none; ${option} needs a target a sync binder reads it for (a model), or a thunk answering one.`);

  const make = (adopt                                             , after                           )                          => {
    const defs = Object.fromEntries(Object.entries(properties)
      .map(([key, prop]) => [key, { default: prop.defaultValue, pack: prop.pack, unpack: prop.unpack }]));
    const store            = createStore(defs, { name, accessors: false });

    const teardowns = new Teardowns();
    const own = (teardown          )           => {
      for (const one of Array.isArray(teardown) ? teardown : [teardown])
        if (one) teardowns.own(one);
      return teardown;
    };
    const attach = (host                               ) => {
      const offs                    = [];
      for (const key of store.keys()) offs.push(store.subscribe(key, () => host.$requestUpdate()));
      return () => offs.forEach((off) => off());
    };
    const dispose = ()                            => {
      const drain = () => teardowns.drain(name);
      const result          = typeof disconnected === "function" ? (disconnected                              ).call(instance) : undefined;
      if (!isThenable(result)) {
        drain();
        return undefined;
      }
      return (result                    ).then(drain, (error         ) => {
        drain();
        throw error;
      });
    };

    const instance                          = {
      $name: name,
      $state: store,
      $sync: store.$sync,
      $queries: writableRecord().record,
      $own: own,
      $attach: attach,
      $dispose: dispose,
    };
    registerWriter(
      new RecordWriter(
        instance,
        (key, value) => {
          instance[key] = value;
        },
        null,
      ),
    );

    for (const key of Object.keys(properties))
      Object.defineProperty(instance, key, {
        get: () => store.get(key),
        set: (value         ) => store.set(key, value),
        enumerable: true,
      });

    for (const [key, desc] of memberDescs) {
      const value = (desc                       ).value;
      if (desc.get || desc.set) Object.defineProperty(instance, key, { ...desc, enumerable: true });
      else instance[key] = typeof value === "function" ? value.bind(instance) : freshCopy(value);
    }

    const pending                  = [];
    for (const [key, prop] of Object.entries(properties)) {
      if (!prop.sync) continue;
      const { unbind, loaded } = bindProperty({ store, key, prop, host: instance });
      own(unbind);
      if (loaded) pending.push(loaded);
    }

    adopt(instance);
    const start = ()          => (typeof connected === "function" ? (connected                              ).call(instance) : undefined);
    const started          = after ? after.then(start) : start();
    if (isThenable(started)) pending.push((started                    ).then(() => undefined));
    instance.$ready = pending.length
      ? tracked(Promise.all(pending).then(() => undefined), `controller:${name}`)
      : Promise.resolve();
    return instance;
  };

  let current                                 = null;
  let retiring                                 = null;
  let teardown                       = null;
  let registered = false;

  const build = () => {
    try {
      const made = make((adopted) => {
        current = adopted;
      }, teardown ?? undefined);
      if (registered) registerAdapter(name, made);
      return made;
    } catch (error) {
      current = null;
      throw error;
    }
  };
  const instance = () => current ?? retiring ?? build();
  const arm = () => registerLazyAdapter(name, () => {
    if (current) registerAdapter(name, current);
    else build();
  });

  const handle                          = {
    definition,
    has: () => Boolean(current ?? retiring),
    dispose: () => {
      const retired = current;
      if (!retired) return undefined;
      current = null;
      retiring = retired;
      if (registered) {
        unregisterAdapter(name);
        arm();
      }
      const clear = () => {
        if (retiring === retired) retiring = null;
      };
      const done          = (retired.$dispose                 ).call(retired);
      if (!isThenable(done)) {
        clear();
        return undefined;
      }
      const settled = done                 ;
      settled.then(clear, clear);
      const gate = Promise.all([teardown ?? Promise.resolve(), settled]).then(() => {}, () => {});
      teardown = gate;
      gate.then(() => {
        if (teardown === gate) teardown = null;
      });
      return settled;
    },
  };

  for (const key of [...Object.keys(properties), ...memberDescs.keys(), ...INSTANCE_KEYS])
    Object.defineProperty(handle, key, {
      get: () => instance()[key],
      set: (value         ) => {
        const writer = writerOf(instance());
        if (writer) writer.writeKey(key, value);
      },
    });
  Object.defineProperty(handle, "$ready", { get: () => (teardown ?? Promise.resolve()).then(() => instance().$ready) });
  for (const [key, why] of Object.entries(RETIRED))
    Object.defineProperty(handle, key, {
      get: () => {
        throw new Error(`Controller "${name}": .${key} is gone; ${why}`);
      },
    });
  Object.freeze(handle);

  handles.set(handle, {
    named: () => registered,
    register() {
      registered = true;
      arm();
    },
  });
  return handle;
};

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
 */
                                 
                                                
                                                                              
                                                         
  
                                                                                                                                                                                                                                                
                                                                                     
export function defineController(rawDefinition                  )                          {
  return createController(composeDefinition(rawDefinition));
}

/**
 * Make each controller a sync target by its name: `sync: "<name>"` binds to
 * it, building it on the first binding, and after `dispose()` a later binding
 * reaches the next instance. A name a sync adapter already holds is refused,
 * since one of the two would answer for both; a controller named twice is
 * named once.
 */
export const nameControllers = (controllers                                        ) => {
  for (const handle of controllers) {
    const entry = handles.get(handle);
    if (!entry || entry.named()) continue;
    const { name } = handle.definition                    ;
    if (getAdapter(name)) throw new Error(`Controller "${name}" has the name of the sync adapter "${name}"; rename the controller`);
    entry.register();
  }
};
