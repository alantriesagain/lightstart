/**
 * @bootstrapp/light/dom/view: the browser View. A custom element base class
 * whose instance is the component's own element: attributes reflect
 * properties, light-DOM slots project children, `View.define` builds a class
 * from a definition object and `View.register` installs a class written by
 * hand, with signal fields and a render the engine tracks. The update cycle
 * itself is the host-neutral ViewCore in view/core.js, whose methods this
 * class carries on its own prototype.
 */
import { cloneDefault, isReactive, normalizeProperties, parse } from "../types/index.js";
import { createStore } from "../signals/store.ts";
import { assertDefinitionKeys, composeDefinition, isThenable, LIFECYCLE_HOOKS } from "../view/definition.js";
import { UNSLOTTED_TAG, hasRootPart, isMoving, projectSlots, render, topLevelPair, unprojectUnits } from "../html/index.js";
import { untracked } from "../signals/index.ts";
import { CORE_METHODS, ViewCore, config } from "../view/core.ts";

/**
 * Store field specs from a properties schema. Defaults are wrapped in a
 * factory returning the declared value by reference; the store must not
 * structured-clone or invoke a `defaultValue`, matching how views have always
 * shared defaults.
 *
 * @param {PropertiesSchema} properties
 */
const storeDefs = (properties) =>
  Object.fromEntries(
    Object.entries(properties ?? {})
      .filter(([, prop]) => isReactive(prop))
      .map(([key, prop]) => [key, { default: () => prop.defaultValue }]),
  );

/** @import { TypeDefinition } from "../types/types.ts" */
/** @import { ProjectHooks } from "./types.ts" */
/** @import { SlotPart } from "./slots.js" */
/**
 * @import {
 *   PropertiesSchema, LifecycleHook, LifecycleEventDetail,
 *   ViewPlugin, ComponentDefinition, ComponentEntry,
 *   ViewConstructor,
 * } from "../view/types.ts"
 */

/**
 * Whether `key` is a member the View base class installs on every element
 * (`$emit`, `$requestUpdate`, `connectedCallback`, `$update`, ...). `render`
 * is the one base member a definition is meant to supply.
 * @param {string} key
 */
const isFrameworkMember = (key) => key !== "render" && Object.hasOwn(View.prototype, key);

const SANITIZE_KEYS = ["__proto__", "constructor", "prototype"];

/** @param {string} prop */
const kebabOf = (prop) => prop.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const SLOT_OBSERVE = { childList: true, attributes: true, attributeFilter: ["slot", "name"] };
/** @type {WeakSet<View>} */
const projectingHosts = new WeakSet();
/** @type {WeakMap<Element, View>} */
const projectedBy = new WeakMap();
/** @type {WeakMap<Element, View>} */
const slotOwner = new WeakMap();
/** @type {MutationObserver | null} */
let slotObserver = null;

/** @param {MutationRecord[]} records */
const onSlotRecords = (records) => {
  /** @type {Set<View>} */
  const due = new Set();
  for (const record of records) {
    const target = /** @type {Element} */ (record.target);
    const host =
      record.type === "attributes"
        ? projectedBy.get(target) ?? slotOwner.get(target)
        : projectingHosts.has(/** @type {View} */ (target))
          ? /** @type {View} */ (target)
          : slotOwner.get(target);
    if (host) due.add(host);
  }
  for (const host of due) host.$project();
};

/** @param {Node} target */
const observeForSlots = (target) => {
  slotObserver ??= new MutationObserver(onSlotRecords);
  slotObserver.observe(target, SLOT_OBSERVE);
};

const KNOWN_DEFINITION_KEYS = ["mixins", "props", "events", "extends", "icons", "formAssociated", "style", "class", "role", "tag"];

/**
 * @param {ViewConstructor} base
 * @returns {ViewPlugin[]} the registered plugins and the base's, a later one replacing an earlier one of the same name
 */
const pluginsFor = (base) => [...new Map([...View.plugins, ...base.plugins].map((plugin) => [plugin.name, plugin])).values()];

/**
 * @param {ViewPlugin[]} plugins
 * @returns {string[]} the engine's lifecycle hooks and every hook the plugins add
 */
const hooksOf = (plugins) => [...LIFECYCLE_HOOKS, ...plugins.flatMap((plugin) => plugin.hooks ?? [])];

const BaseElement = /** @type {typeof HTMLElement} */ (globalThis.HTMLElement ?? class {});

/**
 * A render written as a function of the element. Method-style, so a render
 * typed for its own element's members is accepted for any element.
 * @typedef {{ render(el: View): unknown }["render"]} RenderFn
 */

/**
 * An element's members read and written by name, for the keys its
 * definition declares.
 * @param {object} el
 * @returns {Record<string, unknown>}
 */
const membersOf = (el) => /** @type {Record<string, unknown>} */ (el);

/** @type {WeakMap<object, ComponentDefinition>} */
const composedDefinitions = new WeakMap();

/**
 * The definition a `View.define` argument stands for: a function is a render,
 * the same function answering the same object every time so a repeated call
 * is the no-op it is for an object.
 * @param {ComponentDefinition | RenderFn} value
 * @returns {ComponentDefinition}
 */
const asDefinition = (value) => {
  if (typeof value !== "function") return value;
  let wrapped = composedDefinitions.get(value);
  if (!wrapped) composedDefinitions.set(value, (wrapped = { render: value }));
  return wrapped;
};

/** @type {WeakMap<object, { props: unknown, raw: ComponentDefinition }>} */
const withPropsCache = new WeakMap();

/**
 * @param {string | ComponentDefinition} tagOrDefinition
 * @param {ComponentDefinition | import("../view/types.ts").PropertyDeclarations | RenderFn} [propsOrDefinition]
 * @param {ComponentDefinition | RenderFn} [definition]
 * @returns {ViewConstructor | Promise<ViewConstructor>}
 */
const define = (tagOrDefinition, propsOrDefinition, definition) => {
  if (typeof tagOrDefinition !== "string") {
    const raw = asDefinition(tagOrDefinition);
    if (!raw.tag) throw new Error("[View.define] the definition has no tag; pass one or add tag to the definition");
    return View._define(raw.tag, raw);
  }
  if (definition === undefined) return View._define(tagOrDefinition, asDefinition(/** @type {ComponentDefinition | RenderFn} */ (propsOrDefinition)));
  const body = asDefinition(definition);
  if ("props" in body) throw new Error(`[View.define] <${tagOrDefinition}>: the props go in the second argument, not inside the definition`);
  return View._define(tagOrDefinition, withProps(/** @type {import("../view/types.ts").PropertyDeclarations} */ (propsOrDefinition), body));
};

/**
 * `{ props, ...body }` with the body's property descriptors kept (a getter is
 * not read at define time), the same object again for the same pair.
 * @param {import("../view/types.ts").PropertyDeclarations} props
 * @param {ComponentDefinition} body
 * @returns {ComponentDefinition}
 */
const withProps = (props, body) => {
  const hit = withPropsCache.get(body);
  if (hit && hit.props === props) return hit.raw;
  const raw = /** @type {ComponentDefinition} */ (Object.defineProperties({ props }, Object.getOwnPropertyDescriptors(body)));
  withPropsCache.set(body, { props, raw });
  return raw;
};

const core = ViewCore.prototype;

class View extends BaseElement {
  /** @type {PropertiesSchema} */
  static properties = {};
  /**
   * Whether `render` runs tracked, so a signal it reads re-renders the
   * element. On for a class written by hand; off for a class `View.define`
   * builds, whose properties drive its updates.
   * @type {boolean}
   */
  static $trackRender = true;
  /**
   * Whether the lifecycle hooks are methods of the class (`connected()`,
   * `updated(changed)`, ...), as a class written by hand declares them;
   * off for a class `View.define` builds, whose hooks come from its definition.
   * @type {boolean}
   */
  static $methodHooks = true;
  /** @type {Map<string, ComponentEntry>} */
  static components = new Map();
  /** @type {Record<string, string>} */
  static _attrs = {};
  /** @type {ViewPlugin[]} */
  static plugins = [];

  /**
   * Register a plugin for every class built from now on. A plugin with the
   * same name replaces the earlier one.
   * @param {ViewPlugin} plugin
   */
  static use(plugin) {
    View.plugins = [...View.plugins.filter((known) => known.name !== plugin.name), plugin];
  }

  /**
   * Run the `init` of every plugin a class just built carries.
   * @param {ViewConstructor} component
   * @param {ComponentDefinition} definition
   * @param {string} tag
   */
  static initPlugins(component, definition, tag) {
    return Promise.all(component.plugins.map((plugin) => plugin.init?.({ View, component, definition, tag })));
  }

  /**
   * Install a class written by hand as the custom element `tag`: signal
   * fields, a `render()` the engine tracks, and `connected`, `disconnected`,
   * `willUpdate`, `firstUpdated`, `updated` as plain methods.
   * @template {ViewConstructor} C
   * @param {string} tag
   * @param {C} component
   * @returns {C}
   */
  static register(tag, component) {
    component.tag = tag;
    customElements.define(tag, component);
    View.components.set(tag, { ...View.components.get(tag), _constructor: component });
    return component;
  }

  /** @type {import("../signals/types.ts").Store} */
  $state = /** @type {import("../signals/types.ts").Store} */ (createStore(this.$ctor._storeDefs ?? {}, { name: this.$ctor.tag ?? "view", accessors: false }));
  /**
   * The values of the props declared `reactive: false`, made on first use.
   * @type {Record<string, unknown> | null}
   */
  _plainFields = null;
  $hasUpdated = false;
  $forceNextUpdate = false;
  /** @type {Map<string, unknown>} */
  $changedProps = new Map();
  $updatePending = false;
  /** @type {Promise<void> | null} */
  $updatePromise = null;
  /** @type {(() => void) | null} */
  $resolveUpdate = null;
  /** @type {(() => void) | null} */
  $settleDone = null;
  /** @type {Array<() => void> | null} */
  $teardowns = null;
  /** @type {ViewCore["$renderNode"]} */
  $renderNode = null;
  /** @type {(() => void) | null} */
  $unobserve = null;
  $attrOriginated = false;
  $ignoreAttributeChange = false;
  /** @type {ReturnType<typeof render> | null} */
  $root = null;
  /** @type {Set<SlotPart>} */
  $slotParts = new Set();
  $projectQueued = false;
  $projecting = false;
  $projectAgain = false;
  /** @type {ProjectHooks | null} */
  $slotHooks = null;
  /** @type {Set<string> | null} */
  $slotWarned = null;
  /** @type {Element | null} */
  $unslotted = null;

  /**
   * Typed view of `this.constructor`: includes framework-added
   * statics (`tag`, `_classTags`, …).
   *
   * @returns {ViewConstructor}
   */
  get $ctor() {
    return /** @type {ViewConstructor} */ (/** @type {unknown} */ (this.constructor));
  }

  /**
   * Build a concrete `HTMLElement` subclass from a component
   * `definition` (object literal). Installs property descriptors,
   * binds methods, merges plugins, and keeps the lifecycle hooks on the
   * class for `$runHook`.
   *
   * @param {string} tag
   * @param {ComponentDefinition} definition
   * @param {ViewConstructor} [BaseClass]
   * @returns {ViewConstructor}
   */
  static createClass(tag, definition, BaseClass) {
    if (typeof definition === "function")
      throw new Error(`[view] <${tag}>: the definition is a function; export the definition object itself`);
    const base = /** @type {ViewConstructor} */ (BaseClass ?? View);
    const plugins = pluginsFor(base);
    const hooks = hooksOf(plugins);
    const def = composeDefinition(definition, hooks);
    const consumed = new Set([...KNOWN_DEFINITION_KEYS, ...hooks, ...plugins.flatMap((plugin) => plugin.keys ?? [])]);

    assertDefinitionKeys(def, `[view] <${tag}>`, consumed);

    const { icons, formAssociated = false, style = false, class: klass, role } = def;
    const properties = normalizeProperties(def.props ?? {});

    /** @type {Record<string, unknown>} */
    const prototypeMethods = {};
    for (const key of Object.keys(def)) {
      if (consumed.has(key)) continue;
      if (SANITIZE_KEYS.includes(key)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(def, key);
      if (descriptor) Object.defineProperty(prototypeMethods, key, descriptor);
    }

    const methodKeysToBind = Object.keys(prototypeMethods).filter((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototypeMethods, key);
      return descriptor && !descriptor.get;
    });
    /** @type {ViewConstructor} */
    const component = class extends base {
      static $trackRender = false;
      static $methodHooks = false;
      static icons = icons;
      static style = style;
      static _klass = klass;
      static _role = role;
      static formAssociated = formAssociated;
      static plugins = plugins;
      /** @type {Record<string, LifecycleHook | undefined>} */
      static _hooks = Object.fromEntries(hooks.map((hook) => [hook, /** @type {Record<string, LifecycleHook | undefined>} */ (def)[hook]]));
      /** @type {Map<string, LifecycleHook[]> | null} */
      static _hookLists = null;
      static _classTags = (() => {
        /** @type {string[]} */
        const tags = [];
        /** @type {ViewConstructor | undefined} */
        let proto = base;
        while (proto?.tag) {
          tags.unshift(proto.tag);
          proto = /** @type {ViewConstructor | undefined} */ (Object.getPrototypeOf(proto));
        }
        tags.push(tag);
        return tags;
      })();

      constructor() {
        super();
        const self = membersOf(this);
        methodKeysToBind.forEach((key) => {
          const method = self[key];
          if (typeof method === "function") self[key] = /** @type {(...args: unknown[]) => unknown} */ (method).bind(this);
        });
      }

      static get observedAttributes() {
        return Object.keys(component.properties)
          .filter(
            /** @param {string} key */ (key) =>
              component.properties[key].attribute !== false,
          )
          .flatMap(/** @param {string} key */ (key) => {
            const lower = key.toLowerCase();
            const kebab = kebabOf(key);
            return kebab === lower ? [lower] : [lower, kebab];
          });
      }

      static properties = (() => {
        const baseProperties = base.properties || {};
        /** @type {PropertiesSchema} */
        const merged = { ...baseProperties };

        for (const key of Object.keys(properties)) {
          if (SANITIZE_KEYS.includes(key)) continue;

          const config = properties[key];
          const inherited = merged[key];
          const nested = config.$type === "object" && config.props && inherited?.props
            ? { props: { ...inherited.props, ...config.props } }
            : null;
          merged[key] = /** @type {TypeDefinition} */ ({ ...inherited, ...config, ...nested });
        }
        return plugins.reduce((current, plugin) => plugin.props?.(current, def) ?? current, merged);
      })();
    };

    Object.defineProperty(component, "name", { value: tag });

    for (const [key, prop] of Object.entries(component.properties)) {
      const { setter, getter } = /** @type {TypeDefinition} */ (prop);
      if (isFrameworkMember(key) || key === "render")
        throw new Error(`[view] <${tag}>: property "${key}" is a framework member on the element; rename it`);

      if (!isReactive(prop)) {
        Object.defineProperty(component.prototype, key, {
          configurable: true,
          enumerable: true,
          /** @this {View} */
          get() {
            const store = this._plainFields ?? (this._plainFields = {});
            return key in store ? store[key] : (store[key] = cloneDefault(prop));
          },
          /** @this {View} @param {unknown} value */
          set(value) {
            (this._plainFields ?? (this._plainFields = {}))[key] = value;
          },
        });
        continue;
      }

      Object.defineProperty(component.prototype, key, {
        configurable: true,
        enumerable: true,
        get: getter
          ? /** @this {View} */ function () {
              return /** @type {() => unknown} */ (getter).call(this);
            }
          : /** @this {View} */ function () {
              return this.$state.get(key);
            },
        set: setter
          ? /** @this {View} @param {unknown} value */ function (value) {
              /** @type {(value: unknown) => void} */ (setter).call(this, value);
            }
          : /** @this {View} @param {unknown} value */ function (value) {
              this.$state.set(key, value);
            },
      });
    }

    for (const key of Object.keys(prototypeMethods)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototypeMethods, key);
      if (!descriptor) continue;
      if (isFrameworkMember(key))
        throw new Error(`[view] <${tag}>: "${key}" is a framework member on the element; rename it`);
      if (descriptor.get || descriptor.set)
        Object.defineProperty(component.prototype, key, {
          configurable: true,
          enumerable: true,
          get: descriptor.get,
          set: descriptor.set,
        });
       else
        membersOf(component.prototype)[key] = /** @type {{ value?: unknown }} */ (descriptor).value;

    }

    component.tag = tag;
    component._storeDefs = storeDefs(component.properties);
    component._attrs = Object.fromEntries(
      Object.entries(component.properties)
        .filter(([, prop]) => isReactive(prop))
        .flatMap(
          /** @param {[string, unknown]} entry */ ([prop]) => {
            const lower = prop.toLowerCase();
            const kebab = kebabOf(prop);
            return kebab === lower ? [[lower, prop]] : [[lower, prop], [kebab, prop]];
          },
        ),
    );

    component.plugins = plugins.filter((plugin) => !plugin.test || plugin.test({ component, definition: def }));

    return /** @type {ViewConstructor} */ (component);
  }

  static define = /** @type {import("../view/types.ts").Define} */ (/** @type {unknown} */ (define));

  /**
   * @param {string} tag
   * @param {ComponentDefinition} raw
   * @returns {ViewConstructor | Promise<ViewConstructor>}
   */
  static _define(tag, raw) {
    const registered = View.components.get(tag);
    const existing = /** @type {ViewConstructor | undefined} */ (/** @type {unknown} */ (customElements.get(tag)));
    if (existing) {
      if (registered?.definition && registered.definition !== raw)
        throw new Error(`[View.define] <${tag}> is already defined with another definition`);
      if (!registered?.definition) View.components.set(tag, { ...registered, _constructor: existing, definition: raw });
      return existing;
    }
    const definition = composeDefinition(raw, hooksOf(View.plugins));
    const extendsTag = typeof definition?.extends === "string" ? definition.extends : null;
    const BaseClass = extendsTag
      ? /** @type {ViewConstructor | undefined} */ (/** @type {unknown} */ (customElements.get(extendsTag)) ?? View.components.get(extendsTag)?._constructor)
      : undefined;
    if (extendsTag && !BaseClass) {
      View.components.set(tag, { ...registered, definition: raw });
      const pending = customElements.whenDefined(extendsTag).then(() => View._define(tag, raw));
      config.wrap(pending, `view:${tag}:extends`);
      return pending;
    }
    const component = View.createClass(tag, definition, BaseClass);
    config.wrap(View.initPlugins(component, definition, tag), `view:${tag}:init`);
    customElements.define(tag, component);
    View.components.set(tag, { ...registered, _constructor: component, definition: raw });
    return component;
  }

  /**
   * Subscribe to DOM events (delegated via `selector#eventType` syntax)
   * or CustomEvents (auto-unwraps `detail`).
   *
   * @param {string} eventName
   * @param {import("../view/types.ts").ViewEventListener} listener
   * @returns {EventListener}
   */
  $on(eventName, listener) {
    if (eventName.includes("#")) {
      const [selector, eventType] = eventName.split("#");
      /** @type {EventListener} */
      const delegatedListener = (event) => {
        const target = /** @type {Element} */ (event.target).closest(/** @type {string} */ (selector));
        if (target && this.contains(target)) listener(event);
      };
      this.addEventListener(/** @type {string} */ (eventType), delegatedListener);
      return delegatedListener;
    }
    /** @type {EventListener} */
    const wrapper = (event) => {
      listener(/** @type {CustomEvent<unknown>} */ (event).detail);
    };
    this.addEventListener(eventName, wrapper);
    return wrapper;
  }

  /**
   * @param {string} eventName
   * @param {EventListener} listener
   */
  $off(eventName, listener) {
    if (eventName.includes("#")) {
      const [, eventType] = eventName.split("#");
      this.removeEventListener(/** @type {string} */ (eventType), listener);
    } else this.removeEventListener(eventName, listener);
  }

  /**
   * Dispatch a CustomEvent on this element. Emitted events don't bubble, so
   * only element-attached listeners (`@name=` in a parent template) receive
   * one. They are cancelable: a listener's `preventDefault()` shows on the
   * returned event as `defaultPrevented`, which is how a component lets its
   * parent take over the action it would otherwise perform.
   *
   * @param {string} eventName
   * @param {unknown} [data]
   */
  $emit(eventName, data) {
    const event = new CustomEvent(eventName, { detail: data, cancelable: true });
    this.dispatchEvent(event);
    return event;
  }

  /**
   * Run every lifecycle hook registered under `name`: plugin hooks in plugin
   * order, then every definition's own up the `extends:` chain, oldest
   * ancestor first, which is the order `composeDefinition` gives mixins. Hooks
   * are called directly, never dispatched as DOM events, so the lifecycle names
   * stay free for the component's own events. An async hook goes to the
   * configured `wrap`.
   *
   * @param {string} name
   * @param {LifecycleEventDetail} detail
   */
  $runHook(name, detail) {
    const ctor = this.$ctor;
    const lists = (ctor._hookLists ??= /** @type {Map<string, LifecycleHook[]>} */ (new Map()));
    let fns = lists.get(name);
    if (!fns) {
      /** @type {LifecycleHook[]} */
      const own = [];
      for (let klass = /** @type {ViewConstructor | undefined} */ (ctor); klass; klass = /** @type {ViewConstructor | undefined} */ (Object.getPrototypeOf(klass)))
        if (Object.hasOwn(klass, "_hooks") && klass._hooks?.[name]) own.unshift(/** @type {LifecycleHook} */ (klass._hooks[name]));
      fns = [...ctor.plugins.flatMap((plugin) => plugin.events?.[name] ?? []), ...own];
      lists.set(name, fns);
    }
    for (const fn of fns) {
      const result = fn.call(this, detail);
      if (isThenable(result)) config.wrap(/** @type {Promise<void>} */ (result), `view:${ctor.tag}:${name}`);
    }
    this.$runMethodHook(name, detail.changedProps ?? null);
  }

  /**
   * Call the hook a class written by hand declares as a method (a class
   * `View.define` built has its hooks on the class, run above). The update
   * hooks receive the changed properties.
   * @param {string} name
   * @param {Map<string, unknown> | null} changedProps
   */
  $runMethodHook(name, changedProps) {
    if (!this.$ctor.$methodHooks || !LIFECYCLE_HOOKS.includes(name)) return;
    const method = membersOf(this)[name];
    if (typeof method !== "function") return;
    const fn = /** @type {(this: View, changedProps?: Map<string, unknown>) => unknown} */ (method);
    const result = changedProps === null ? fn.call(this) : fn.call(this, changedProps);
    if (isThenable(result)) config.wrap(/** @type {Promise<unknown>} */ (result), `view:${this.$ctor.tag}:${name}`);
  }

  /** @param {string} element */
  $ = (element) => this.querySelector(element);
  /** @param {string} element */
  $$ = (element) => this.querySelectorAll(element);

  connectedCallback() {
    if (isMoving()) return;
    untracked(() => this.$connect());
  }

  connectedMoveCallback() {}

  $connect() {
    const w = /** @type {Window & { __PRERENDERED__?: boolean }} */ (window);
    if (w.__PRERENDERED__ && this.hasAttribute("client:render")) {
      this.removeAttribute("client:render");
      unprojectUnits(this);
      const pair = topLevelPair(this);
      /** @type {ChildNode | null} */
      let node = pair?.start ?? null;
      while (node) {
        const next = pair && node === pair.end ? null : node.nextSibling;
        node.remove();
        node = next;
      }
    }

    if (this.$ctor.properties) this.$initProps();
    this.$unobserve?.();
    this.$unobserve = this.$state.observe((key, value, oldValue) => {
      const prop = this.$ctor.properties[key];
      if (prop?.attribute && !this.$attrOriginated && !this.$ignoreAttributeChange)
        this.$updateAttribute({ key, value, skipPropUpdate: true, type: prop.$type });
      this.$enqueueUpdate(key, oldValue);
    });
    if (this.$ctor._klass) this.classList.add(...this.$ctor._klass.split(" "));
    if (this.$ctor._role && !this.hasAttribute("role")) this.setAttribute("role", this.$ctor._role);
    if (this.$ctor._classTags && this.$ctor._classTags.length > 0)
      this.classList.add(...this.$ctor._classTags);

    this.$attach();
  }

  /**
   * Hold a teardown until disconnect. Pass any unsubscribe function (an
   * event bus `on` return, a store's `subscribe` handle, a DOM listener
   * remover) or an array of them (falsy entries skipped), and it runs when
   * the element leaves the DOM, so subscriptions made in `connected()` need
   * no `disconnected()` bookkeeping. Returns the argument so the call wraps
   * the subscription inline: `this.$own(bus.on(NAME, cb))`.
   *
   * @template {(() => void) | Array<(() => void) | null | undefined | false>} T
   * @param {T} teardown
   * @returns {T}
   */
  $own(teardown) {
    /** @type {(() => void) | Array<(() => void) | null | undefined | false>} */
    const given = teardown;
    for (const one of typeof given === "function" ? [given] : given)
      if (one) (this.$teardowns ??= []).push(one);
    return teardown;
  }

  disconnectedCallback() {
    if (isMoving()) return;
    this.$unobserve?.();
    this.$unobserve = null;
    this.$detach();
  }

  $initProps() {
    for (const attr of Array.from(this.attributes)) {
      const key = this.$ctor._attrs[attr.name];
      if (!key) continue;
      const prop = this.$ctor.properties[key];
      if (prop && prop.$type !== "boolean" && attr.value === "") {
        this.removeAttribute(attr.name);
        continue;
      }
      this.$state.set(key, prop ? parse(attr.value, { ...prop, attribute: true }) : attr.value);
    }

    for (const [key, prop] of Object.entries(this.$ctor.properties)) {
      if (!isReactive(prop)) continue;
      const { $type: type, attribute } = /** @type {TypeDefinition} */ (prop);
      if (Object.hasOwn(this, key)) {
        const self = membersOf(this);
        const adopted = self[key];
        delete self[key];
        self[key] = adopted;
      }

      const value = this.$state.get(key);
      const isComplex = ["array", "object", "function"].includes(/** @type {string} */ (type));

      if (
        attribute &&
        value !== undefined &&
        !this.hasAttribute(kebabOf(key)) &&
        !this.hasAttribute(key.toLowerCase()) &&
        !isComplex
      )
        this.$updateAttribute({
          key,
          value,
          skipPropUpdate: true,
          type: /** @type {string} */ (type),
        });

      this.$changedProps.set(key, undefined);
    }
  }

  get $node() {
    return this;
  }

  get $connected() {
    return this.isConnected;
  }

  get $label() {
    return this.localName;
  }

  get $tracked() {
    return this.$ctor.$trackRender === true;
  }

  /**
   * @param {string} key
   * @param {unknown} oldValue
   */
  $hasChanged(key, oldValue) {
    const newValue = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this))[key];
    const prop = this.$ctor.properties[key];
    return prop?.hasChanged ? prop.hasChanged(newValue, oldValue) : oldValue !== newValue;
  }

  /**
   * The core's hook call, as the element's `$runHook` with the detail its
   * hooks receive.
   * @param {string} name
   * @param {Map<string, unknown> | null} changedProps
   */
  $hook(name, changedProps) {
    const detail = changedProps === null
      ? { instance: this, component: this.$ctor, tag: this.$ctor.tag }
      : { changedProps, instance: this, component: this.$ctor };
    this.$runHook(name, detail);
  }

  $render() {
    return this.render(this);
  }

  /** @param {unknown} value */
  $commit(value) {
    const w = /** @type {Window & { __PRERENDERED__?: boolean }} */ (window);
    const adopt = !this.$hasUpdated && w.__PRERENDERED__ === true && !hasRootPart(this) && this.childNodes.length > 0;
    this.$root = render(value, this, adopt ? { host: this, adopt: "bind", settle: config.settle } : { host: this });
    this.$project();
  }

  /**
   * Record a changed property (or, with no key, force the next render) and
   * schedule the element's update. Answers the promise of the pending
   * update; inside a running update, that update's own promise.
   *
   * @param {string} [key]
   * @param {unknown} [oldValue]
   * @returns {Promise<void>}
   */
  $requestUpdate(key, oldValue) {
    return core.$requestUpdate.call(this, key, oldValue);
  }

  /**
   * @param {string} [key]
   * @param {unknown} [oldValue]
   */
  $enqueueUpdate(key, oldValue) {
    core.$enqueueUpdate.call(this, key, oldValue);
  }

  /** @returns {Promise<void>} */
  $whenUpdated() {
    return core.$whenUpdated.call(this);
  }

  $schedule() {
    core.$schedule.call(this);
  }

  $flushUpdate() {
    core.$flushUpdate.call(this);
  }

  /** @param {boolean} forceUpdate */
  $performUpdate(forceUpdate) {
    core.$performUpdate.call(this, forceUpdate);
  }

  /**
   * @param {Map<string, unknown>} changedProps
   * @param {boolean} forceUpdate
   */
  $shouldUpdate(changedProps, forceUpdate) {
    return core.$shouldUpdate.call(this, changedProps, forceUpdate);
  }

  $update() {
    core.$update.call(this);
  }

  $attach() {
    core.$attach.call(this);
  }

  $detach() {
    core.$detach.call(this);
  }

  /**
   * @param {string} name
   * @param {unknown} value
   * @returns {boolean}
   */
  $setProp(name, value) {
    return core.$setProp.call(this, name, value);
  }

  /**
   * @param {this} [_el] the element itself, for a render written as an arrow
   * @returns {unknown}
   */
  render(_el) {
    return null;
  }

  $queueProject() {
    if (this.$projectQueued || !this.$slotParts) return;
    this.$projectQueued = true;
    queueMicrotask(() => {
      this.$projectQueued = false;
      this.$project();
    });
  }

  $project() {
    if (!this.$slotParts?.size || !this.$root) return;
    if (this.$projecting) {
      this.$projectAgain = true;
      return;
    }
    this.$projecting = true;
    this.$unslotted ??= this.querySelector(`:scope > ${UNSLOTTED_TAG}`);
    projectingHosts.add(this);
    observeForSlots(this);
    const hooks = (this.$slotHooks ??= {
      watchSlot: (el) => {
        if (slotOwner.get(el) === this) return;
        slotOwner.set(el, this);
        observeForSlots(el);
      },
      watchUnit: (el) => {
        if (projectedBy.get(el) === this) return;
        projectedBy.set(el, this);
        observeForSlots(el);
      },
      unknown: (name) => {
        if (!config.dev) return;
        const warned = (this.$slotWarned ??= new Set());
        if (warned.has(name)) return;
        warned.add(name);
        const which = name ? `slot named "${name}"` : "default slot";
        console.debug(`[view] <${this.localName}> renders no ${which}; that child is held unrendered until one appears`);
      },
    });
    try {
      for (let pass = 0; pass < 3; pass++) {
        this.$projectAgain = false;
        const again = projectSlots(this, hooks);
        if (!again && !this.$projectAgain) break;
      }
    } finally {
      this.$projecting = false;
    }
  }

  /**
   * @param {string} attrName
   * @param {string | null} oldValue
   * @param {string | null} value
   */
  attributeChangedCallback(attrName, oldValue, value) {
    if (oldValue === value) return;
    const key = this.$ctor._attrs[attrName] ?? attrName;
    if (this.$ignoreAttributeChange) return;
    this.$attrOriginated = true;
    this.$state.set(key, parse(value, this.$ctor.properties[key]));
    this.$attrOriginated = false;
  }

  /**
   * Reflect a property value to its attribute. The canonical written form
   * is kebab-case (`use-system-preference`); a legacy all-lowercase form
   * left by markup is removed on first reflection so the element never
   * carries two spellings of the same attribute.
   *
   * @param {{ key: string, value: unknown, type?: string, skipPropUpdate?: boolean }} args
   */
  $updateAttribute({ key, value, type, skipPropUpdate = false }) {
    const attr = kebabOf(key);
    const lower = key.toLowerCase();
    if (attr !== lower && this.hasAttribute(lower)) {
      const prev = this.$ignoreAttributeChange;
      this.$ignoreAttributeChange = true;
      this.removeAttribute(lower);
      this.$ignoreAttributeChange = prev;
    }
    this.$ignoreAttributeChange = skipPropUpdate;
    const isReflectable = type && typeof value !== "function";
    if (isReflectable)
      if (type === "boolean")
        value ? this.setAttribute(attr, "") : this.removeAttribute(attr);
      else if (["array", "object"].includes(/** @type {string} */ (type)))
        this.setAttribute(attr, JSON.stringify(value));
      else if (type === "string" && value != null && String(value).trim().length > 0)
        this.setAttribute(attr, String(value));
      else if (type === "string" || value === null) this.removeAttribute(attr);

    if (!skipPropUpdate) membersOf(this)[key] = value;
    else this.$ignoreAttributeChange = false;
  }
}

for (const name of CORE_METHODS)
  if (name !== "$own") Object.defineProperty(View.prototype, name, /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(core, name)));

/** @param {ViewCore} _core */
const asCore = (_core) => {};
asCore(/** @type {View} */ (/** @type {unknown} */ (null)));

export default View;

/**
 * Typed identity wrapper for a component definition a module exports for a
 * loader to register (`export default defineComponent({...})`). Runtime: the
 * same object verbatim. Type-level: `this` inside `render()` and the hooks
 * is `ComponentThis` (`view/types.ts`): the properties, own and from mixins
 * (`this.count: number`, from a descriptor or a shorthand default), the
 * sibling members, the engine's instance members, the narrowed `$emit`,
 * `_`-prefixed members as `any`, and with `extends` any other member as
 * `unknown`. A page that registers its own components needs no wrapper:
 * `View.define` types the definition the same way.
 *
 * A bare `export default { tag, ... }` types `this` as the literal itself, so
 * every declared property reads as missing; this call is the one way to
 * declare an exported component.
 *
 * @template {Record<string, unknown>} D
 * @template {readonly Record<string, unknown>[] | []} [M=[]]
 * @template {Record<string, import("../types/types.ts").PropertyDeclaration>} [P={}]
 * @template {Record<string, import("../types/types.ts").TypeDefinition<unknown>>} [E={}]
 * @param {import("../view/types.ts").Definition<D, M, P, E>} def
 * @returns {D & { props?: P, events?: E, mixins?: M }}
 */
export const defineComponent = (def) => def;

/**
 * Typed identity wrapper for a definition fragment, the thing a component
 * lists under `mixins: [...]`. Runtime: the same object. Type-level: `this`
 * inside the fragment's methods sees the fragment's own properties and
 * members typed, the framework members, and everything else as `any`, since
 * the host it lands on is not known here. A fragment that takes options is a
 * function returning one of these.
 *
 *   export const withFormControl = defineMixin({
 *     props: { value: T.any(""), disabled: false },
 *     events: { change: T.object({ value: T.any() }) },
 *     syncFormValue() { ... },
 *   });
 *
 *   export default defineComponent({
 *     mixins: [withFormControl],
 *     tag: "lc-input",
 *     props: { type: T.string({ defaultValue: "text" }) },
 *     render() { ... },
 *   });
 *
 * @template {Record<string, unknown>} D
 * @template {Record<string, import("../types/types.ts").PropertyDeclaration>} [P={}]
 * @template {Record<string, import("../types/types.ts").TypeDefinition<unknown>>} [E={}]
 * @param {D & { props?: P, events?: E } & ThisType<import("../view/types.ts").PropsToThis<P> & Omit<D, keyof P | import("../view/types.ts").DefinitionKey> & Omit<View, "$emit"> & { $emit: import("../view/types.ts").TypedEmit<E> } & Record<string, unknown>>} def
 * @returns {D & { props?: P, events?: E }}
 */
export const defineMixin = (def) => def;
