import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import View, { defineComponent, defineMixin } from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
import { disposeTree, element, html, key } from "@bootstrapp/light/html";
import { signal } from "@bootstrapp/light/signals";
import { composeDefinition } from "./definition.js";

let testElementCounter = 0;
const getUniqueTag = (prefix = "test") => `${prefix}-${Date.now()}-${++testElementCounter}`;
describe("light - View.createClass()", () => {
  describe("basic class creation", () => {
    it("should create component class with tag name", () => {
      const tag = getUniqueTag("create-class");
      const component = View.createClass(tag, {
        render() {
          return null;
        },
      });
      assert.equal(component.tag, tag);
      assert.equal(component.name, tag);
    });

    it("should merge properties from definition", () => {
      const tag = getUniqueTag("merge-props");
      const component = View.createClass(tag, {
        props: {
          count: { $type: "number", defaultValue: 0 },
          name: { $type: "string", defaultValue: "" },
        },
        render() {
          return null;
        },
      });
      assert.ok(component.properties.count);
      assert.ok(component.properties.name);
      assert.equal(component.properties.count.$type, "number");
      assert.equal(component.properties.name.$type, "string");
    });

    it("should extract prototype methods from definition", () => {
      const tag = getUniqueTag("proto-methods");
      const component = View.createClass(tag, {
        myMethod() {
          return "test";
        },
        anotherMethod() {
          return 42;
        },
        render() {
          return null;
        },
      });
      assert.equal(typeof component.prototype.myMethod, "function");
      assert.equal(typeof component.prototype.anotherMethod, "function");
    });

    it("should set up observedAttributes from properties", () => {
      const tag = getUniqueTag("observed-attrs");
      const component = View.createClass(tag, {
        props: {
          visible: { $type: "boolean", defaultValue: true },
          label: { $type: "string", defaultValue: "" },
          data: { $type: "object", attribute: false },
        },
        render() {
          return null;
        },
      });
      const observed = component.observedAttributes;
      assert.ok(observed.includes("visible"));
      assert.ok(observed.includes("label"));
      assert.equal(observed.includes("data"), false);
    });
  });

  describe("property inheritance", () => {
    it("should inherit properties from base class", () => {
      const baseTag = getUniqueTag("base-inherit");
      const BaseComponent = View.createClass(baseTag, {
        props: {
          baseValue: { $type: "string", defaultValue: "base" },
        },
        render() {
          return null;
        },
      });

      const childTag = getUniqueTag("child-inherit");
      const ChildComponent = View.createClass(
        childTag,
        {
          props: {
            childValue: { $type: "number", defaultValue: 0 },
          },
          render() {
            return null;
          },
        },
        BaseComponent,
      );

      assert.ok(ChildComponent.properties.baseValue);
      assert.ok(ChildComponent.properties.childValue);
    });
  });
});

describe("light - framework member names", () => {
  it("lets a definition name a member after a DOM method: the checker catches that, not the engine", () => {
    View.define(getUniqueTag("shadow-ok"), { removeItem() {}, start() {}, toString() { return "x"; } });
  });

  it("refuses a $-prefixed property or member: the prefix belongs to the framework", () => {
    assert.throws(() => View.define(getUniqueTag("dollar-prop"), { props: { $state: T.string() } }), /\$ prefix/);
    assert.throws(() => View.define(getUniqueTag("dollar-method"), { $emit() {} }), /\$ prefix/);
    assert.throws(() => View.define(getUniqueTag("dollar-own"), { $helper: 1 }), /\$ prefix/);
  });

  it("refuses a property or method that redefines a View base member, render excepted", () => {
    assert.throws(() => View.define(getUniqueTag("base-cb"), { connectedCallback() {} }), /framework member/);
    assert.throws(() => View.define(getUniqueTag("base-prop"), { props: { render: T.string() } }), /framework member/);
    View.define(getUniqueTag("base-render"), { render() { return null; } });
  });

  it("leaves the whole _ namespace to the component, since the engine takes only $", () => {
    const tag = getUniqueTag("underscore-names");
    View.define(tag, {
      props: { _teardowns: "mine" },
      _update() { return "mine"; },
      _ctor() { return "mine"; },
      _runHook() { return "mine"; },
      render() { return null; },
    });

    const el = /** @type {any} */ (document.createElement(tag));
    document.body.appendChild(el);
    assert.equal(el._update(), "mine", "a name the engine used to hold is the author's now");
    assert.equal(el._teardowns, "mine");
    el.remove();
  });

  it("refuses a name declared as both a property and a member", () => {
    assert.throws(
      () => View.define(getUniqueTag("both"), { props: { total: T.number() }, total() {} }),
      /both a property and a member/,
    );
  });

  it("frees the old engine names as properties: state, emit, own, ready, config, update, get, keys", async () => {
    const tag = getUniqueTag("freed-names");
    View.define(tag, {
      props: {
        state: "idle",
        emit: false,
        own: 1,
        ready: false,
        config: T.object({ defaultValue: null }),
        update: "",
        get: "",
        keys: [],
      },
      connected() {
        this.state = "booted";
        this.ready = true;
      },
      render() {
        return html`<span>${this.state}:${this.own}:${this.update}</span>`;
      },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.state, "booted");
    assert.equal(el.getAttribute("state"), "booted");
    assert.equal(el.ready, true);
    assert.equal(el.hasAttribute("ready"), true);
    assert.equal(el.emit, false);
    el.update = "u";
    await el.$requestUpdate();
    assert.equal(el.querySelector("span").textContent, "booted:1:u");
    assert.equal(typeof el.$emit, "function");
    assert.equal(el.$state.get("state"), "booted");
    el.remove();
  });

  it("frees the lifecycle names as properties next to the hooks of the same name", async () => {
    const tag = getUniqueTag("hook-named-props");
    const seen = [];
    View.define(tag, {
      props: {
        connected: false,
        updated: 0,
        disconnected: false,
      },
      connected() {
        this.connected = true;
        seen.push("connected");
      },
      updated({ changedProps }) {
        seen.push(`updated:${[...changedProps.keys()].sort().join(",")}`);
      },
      disconnected() {
        this.disconnected = true;
        seen.push("disconnected");
      },
      render() {
        return html`<b>${this.updated}</b>`;
      },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.connected, true);
    el.updated = 2;
    await el.$requestUpdate();
    assert.equal(el.querySelector("b").textContent, "2");
    el.remove();
    assert.equal(el.disconnected, true);
    assert.deepEqual(seen, ["connected", "updated:connected,disconnected,updated", "updated:updated", "disconnected"]);
  });

  it("frees the lifecycle names as the component's own events: no hook fires on $emit", async () => {
    const tag = getUniqueTag("own-updated-event");
    let hookRuns = 0;
    let received = null;
    View.define(tag, {
      updated() { hookRuns++; },
      render() { return null; },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    const before = hookRuns;
    el.addEventListener("updated", (e) => { received = e.detail; });
    el.$emit("updated", { row: 1 });
    el.$emit("connected");
    assert.deepEqual(received, { row: 1 });
    assert.equal(hookRuns, before);
    el.remove();
  });

  it("runs lifecycle hooks without dispatching DOM events", async () => {
    const tag = getUniqueTag("no-lifecycle-events");
    const dispatched = [];
    View.define(tag, {
      connected() {},
      updated() {},
      render() { return null; },
    });
    const el = document.createElement(tag);
    const original = el.dispatchEvent.bind(el);
    el.dispatchEvent = (event) => { dispatched.push(event.type); return original(event); };
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.remove();
    assert.deepEqual(dispatched, []);
  });

  it("renders a property set during its own update in a follow-up update", async () => {
    const tag = getUniqueTag("set-during-update");
    const childTag = getUniqueTag("leaving-child");
    let host = null;
    View.define(childTag, {
      disconnected() { host.label = "gone"; },
      render() { return html`child`; },
    });
    View.define(tag, {
      props: {
        showChild: true,
        label: "here",
      },
      render() { return html`<span>${this.label}</span>${this.showChild ? element(childTag, {}) : ""}`; },
    });
    host = document.createElement(tag);
    document.body.appendChild(host);
    await host.$requestUpdate();
    assert.equal(host.querySelector("span").textContent, "here");
    host.showChild = false;
    await host.$requestUpdate();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    assert.equal(host.querySelector("span").textContent, "gone");
    host.remove();
  });
});

describe("light - renderless light-DOM components", () => {
  it("keep the children their parent gave them on a prerendered page", async () => {
    const tag = getUniqueTag("renderless");
    View.define(tag, { props: {} });
    const w = /** @type {Window & { __PRERENDERED__?: boolean }} */ (window);
    const previous = w.__PRERENDERED__;
    w.__PRERENDERED__ = true;
    const el = document.createElement(tag);
    el.innerHTML = "<a href='/'>Home</a><a href='/drills'>Drills</a>";
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(el.querySelectorAll("a").length, 2);
    el.remove();
    w.__PRERENDERED__ = previous;
  });
});

describe("light - View.define()", () => {
  describe("element registration", () => {
    it("should define and register custom element", () => {
      const tag = getUniqueTag("define-reg");
      View.define(tag, {
        render() {
          return null;
        },
      });
      const component = customElements.get(tag);
      assert.ok(component);
      assert.equal(component.tag, tag);
    });

    it("takes the tag from the definition when given only the definition", () => {
      const tag = getUniqueTag("define-own-tag");
      View.define({ tag, render() { return null; } });
      assert.equal(customElements.get(tag)?.tag, tag);
    });

    it("refuses a definition without a tag", () => {
      assert.throws(() => View.define({ render() { return null; } }), /no tag/);
    });

    it("registers the class the registry keeps", () => {
      const tag = getUniqueTag("define-return");
      View.define(tag, {
        render() {
          return null;
        },
      });
      const component = View.components.get(tag)?._constructor;
      assert.equal(typeof component, "function");
      assert.equal(component.tag, tag);
    });

    it("defines a tag once: the same definition again is a no-op, another one is refused", () => {
      const tag = getUniqueTag("define-norereg");
      const first = { render() { return "first"; } };
      View.define(tag, first);
      View.define(tag, first);
      assert.throws(() => View.define(tag, { render() { return "second"; } }), /already defined/);
      assert.ok(customElements.get(tag));
    });
  });
});

describe("light - Property System", () => {
  let element;
  let tag;

  beforeEach(() => {
    tag = getUniqueTag("prop-sys");
    View.define(tag, {
      props: {
        count: { $type: "number", defaultValue: 0 },
        name: { $type: "string", defaultValue: "" },
        active: { $type: "boolean", defaultValue: false },
        items: { $type: "array", defaultValue: [] },
        config: { $type: "object", defaultValue: {} },
        internal: { $type: "string", attribute: false, defaultValue: "internal" },
      },
      render() {
        return null;
      },
    });
    element = document.createElement(tag);
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode)
      element.parentNode.removeChild(element);

  });

  describe("default values", () => {
    it("should initialize properties with defaultValue", () => {
      assert.equal(element.count, 0);
      assert.equal(element.name, "");
      assert.equal(element.active, false);
      assert.deepEqual(element.items, []);
      assert.deepEqual(element.config, {});
    });
  });

  describe("attribute parsing", () => {
    it("should parse number attributes", () => {
      const numTag = getUniqueTag("num-attr");
      View.define(numTag, {
        props: {
          value: { $type: "number", defaultValue: 0 },
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(numTag);
      el.setAttribute("value", "42");
      document.body.appendChild(el);
      assert.equal(el.value, 42);
      el.parentNode.removeChild(el);
    });

    it("should parse boolean attributes (empty string = true)", () => {
      const boolTag = getUniqueTag("bool-attr");
      View.define(boolTag, {
        props: {
          enabled: { $type: "boolean", defaultValue: false },
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(boolTag);
      el.setAttribute("enabled", "");
      document.body.appendChild(el);
      assert.equal(el.enabled, true);
      el.parentNode.removeChild(el);
    });

    it("should parse array attributes from JSON", () => {
      const arrTag = getUniqueTag("arr-attr");
      View.define(arrTag, {
        props: {
          data: { $type: "array", defaultValue: [] },
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(arrTag);
      el.setAttribute("data", "[1,2,3]");
      document.body.appendChild(el);
      assert.deepEqual(el.data, [1, 2, 3]);
      el.parentNode.removeChild(el);
    });

    it("should parse object attributes from JSON", () => {
      const objTag = getUniqueTag("obj-attr");
      View.define(objTag, {
        props: {
          options: { $type: "object", defaultValue: {} },
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(objTag);
      el.setAttribute("options", '{"key":"value"}');
      document.body.appendChild(el);
      assert.deepEqual(el.options, { key: "value" });
      el.parentNode.removeChild(el);
    });
  });

  describe("attribute: false", () => {
    it("should skip properties with attribute: false", () => {
      assert.equal(element.internal, "internal");
      const observed = element.constructor.observedAttributes;
      assert.equal(observed.includes("internal"), false);
    });
  });

  describe("reactive updates", () => {
    it("should trigger $requestUpdate on property change", async () => {
      let updateCalled = false;
      const originalRequest = element.$requestUpdate.bind(element);
      element.$requestUpdate = (...args) => {
        updateCalled = true;
        return originalRequest(...args);
      };
      element.count = 5;
      assert.equal(updateCalled, true);
    });

    it("should not trigger update when value unchanged", async () => {
      await element.$requestUpdate();
      let updateCalled = false;
      const originalRequest = element.$requestUpdate.bind(element);
      element.$requestUpdate = (...args) => {
        updateCalled = true;
        return originalRequest(...args);
      };
      element.count = 0;
      assert.equal(updateCalled, false);
    });
  });

  describe("kebab-case attributes", () => {
    let kebabTag;

    beforeEach(() => {
      kebabTag = getUniqueTag("kebab-attrs");
      View.define(kebabTag, {
        props: {
          useSystemPreference: { $type: "boolean", defaultValue: false, attribute: true },
          maxCount: { $type: "number", defaultValue: 0, attribute: true },
        },
        render() {
          return null;
        },
      });
    });

    it("binds the kebab-case attribute form to the camelCase prop", () => {
      const el = document.createElement(kebabTag);
      el.setAttribute("use-system-preference", "");
      el.setAttribute("max-count", "7");
      document.body.appendChild(el);
      assert.equal(el.useSystemPreference, true);
      assert.equal(el.maxCount, 7);
      el.remove();
    });

    it("still binds the legacy collapsed-lowercase form", () => {
      const el = document.createElement(kebabTag);
      el.setAttribute("usesystempreference", "");
      document.body.appendChild(el);
      assert.equal(el.useSystemPreference, true);
      el.remove();
    });

    it("observes runtime changes on both attribute forms", () => {
      const el = document.createElement(kebabTag);
      document.body.appendChild(el);
      el.setAttribute("max-count", "3");
      assert.equal(el.maxCount, 3);
      el.setAttribute("max-count", "9");
      assert.equal(el.maxCount, 9);
      el.remove();
    });

    it("reflects properties to the kebab form and drops a stale legacy form", () => {
      const el = document.createElement(kebabTag);
      el.setAttribute("usesystempreference", "");
      document.body.appendChild(el);
      el.useSystemPreference = false;
      el.useSystemPreference = true;
      assert.equal(el.hasAttribute("use-system-preference"), true);
      assert.equal(el.hasAttribute("usesystempreference"), false);
      el.remove();
    });
  });
});

describe("light - Lifecycle Hooks", () => {
  describe("connected event", () => {
    it("should call connected event on connectedCallback", () => {
      let connectedCalled = false;
      const tag = getUniqueTag("lifecycle-conn");
      View.define(tag, {
        connected() {
          connectedCalled = true;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      assert.equal(connectedCalled, true);
      el.parentNode.removeChild(el);
    });
  });

  describe("disconnected event", () => {
    it("should call disconnected event on disconnectedCallback", () => {
      let disconnectedCalled = false;
      const tag = getUniqueTag("lifecycle-disc");
      View.define(tag, {
        disconnected() {
          disconnectedCalled = true;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.parentNode.removeChild(el);
      assert.equal(disconnectedCalled, true);
    });
  });

  describe("own() teardown registry", () => {
    it("runs registered teardowns on disconnect", () => {
      const torn = [];
      const tag = getUniqueTag("lifecycle-own");
      View.define(tag, {
        connected() {
          this.$own(() => torn.push("a"));
          this.$own(() => torn.push("b"));
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      assert.deepEqual(torn, []);
      el.parentNode.removeChild(el);
      assert.deepEqual(torn, ["a", "b"]);
    });

    it("returns the teardown and isolates a throwing one", () => {
      const torn = [];
      const tag = getUniqueTag("lifecycle-own-err");
      let returned;
      View.define(tag, {
        connected() {
          returned = this.$own(() => {
            throw new Error("boom");
          });
          this.$own(() => torn.push("after"));
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      assert.equal(typeof returned, "function");
      el.parentNode.removeChild(el);
      assert.deepEqual(torn, ["after"]);
    });

    it("drains once, a second disconnect runs nothing", () => {
      let torn = 0;
      const tag = getUniqueTag("lifecycle-own-re");
      View.define(tag, {
        connected() {
          this.$own(() => torn++);
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.parentNode.removeChild(el);
      assert.equal(torn, 1);
      el.disconnectedCallback();
      assert.equal(torn, 1);
    });

    it("accepts an array of teardowns and skips falsy entries", () => {
      const torn = [];
      const tag = getUniqueTag("lifecycle-own-array");
      View.define(tag, {
        connected() {
          this.$own([() => torn.push("a"), null, undefined, () => torn.push("b")]);
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.parentNode.removeChild(el);
      assert.deepEqual(torn, ["a", "b"]);
    });

    it("reconnecting fires connected/disconnected exactly once per cycle", () => {
      let connects = 0;
      let disconnects = 0;
      let torn = 0;
      const tag = getUniqueTag("lifecycle-reconnect");
      View.define(tag, {
        connected() {
          connects++;
          this.$own(() => torn++);
        },
        disconnected() {
          disconnects++;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.parentNode.removeChild(el);
      document.body.appendChild(el);
      el.parentNode.removeChild(el);
      document.body.appendChild(el);
      assert.equal(connects, 3, "connected fires once per connect, not N times after N reconnects");
      assert.equal(disconnects, 2, "disconnected fires once per disconnect");
      assert.equal(torn, 2, "each cycle's own() teardowns drain exactly once");
      el.parentNode.removeChild(el);
      assert.equal(torn, 3);
    });
  });

  describe("willUpdate event", () => {
    it("should call willUpdate before render", async () => {
      const callOrder = [];
      const tag = getUniqueTag("lifecycle-will");
      View.define(tag, {
        willUpdate() {
          callOrder.push("willUpdate");
        },
        render() {
          callOrder.push("render");
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.ok(callOrder.includes("willUpdate"));
      const willIdx = callOrder.indexOf("willUpdate");
      const renderIdx = callOrder.lastIndexOf("render");
      assert.ok(willIdx < renderIdx);
      el.parentNode.removeChild(el);
    });
  });

  describe("firstUpdated event", () => {
    it("should call firstUpdated only once (first render)", async () => {
      let firstUpdatedCount = 0;
      const tag = getUniqueTag("lifecycle-first");
      View.define(tag, {
        props: {
          value: { $type: "number", defaultValue: 0 },
        },
        firstUpdated() {
          firstUpdatedCount++;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      await el.$requestUpdate();
      el.value = 1;
      await el.$requestUpdate();
      el.value = 2;
      await el.$requestUpdate();
      assert.equal(firstUpdatedCount, 1);
      el.parentNode.removeChild(el);
    });
  });

  describe("updated event", () => {
    it("should call updated after every render", async () => {
      let updatedCount = 0;
      const tag = getUniqueTag("lifecycle-upd");
      View.define(tag, {
        props: {
          value: { $type: "number", defaultValue: 0 },
        },
        updated() {
          updatedCount++;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      await el.$requestUpdate();
      const initial = updatedCount;
      el.value = 1;
      await el.$requestUpdate();
      el.value = 2;
      await el.$requestUpdate();
      assert.ok(updatedCount >= initial + 2);
      el.parentNode.removeChild(el);
    });
  });
});

describe("light - Event Methods (on/off/emit)", () => {
  let element;
  let tag;

  beforeEach(() => {
    tag = getUniqueTag("event-methods");
    View.define(tag, {
      render() {
        return null;
      },
    });
    element = document.createElement(tag);
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode)
      element.parentNode.removeChild(element);

  });

  describe("on()", () => {
    it("should register event listener", () => {
      let called = false;
      element.$on("custom-event", () => {
        called = true;
      });
      element.$emit("custom-event");
      assert.equal(called, true);
    });

    it("should pass data to listener via detail", () => {
      let receivedData = null;
      element.$on("data-event", (data) => {
        receivedData = data;
      });
      element.$emit("data-event", { foo: "bar" });
      assert.deepEqual(receivedData, { foo: "bar" });
    });

    it("should support delegated events with selector#eventType syntax", () => {
      const delegateTag = getUniqueTag("delegate-test");
      View.define(delegateTag, {
        render() {
          return null;
        },
      });
      const container = document.createElement(delegateTag);
      const button = document.createElement("button");
      button.className = "my-btn";
      container.appendChild(button);
      document.body.appendChild(container);

      let delegatedCalled = false;
      container.$on(".my-btn#click", () => {
        delegatedCalled = true;
      });
      button.click();
      assert.equal(delegatedCalled, true);
      container.parentNode.removeChild(container);
    });

    it("should return wrapper function for removal", () => {
      const wrapper = element.$on("test-event", () => {});
      assert.equal(typeof wrapper, "function");
    });
  });

  describe("off()", () => {
    it("should remove event listener", () => {
      let callCount = 0;
      const handler = element.$on("remove-event", () => {
        callCount++;
      });
      element.$emit("remove-event");
      assert.equal(callCount, 1);
      element.$off("remove-event", handler);
      element.$emit("remove-event");
      assert.equal(callCount, 1);
    });

    it("should remove delegated event listener", () => {
      const delegateTag = getUniqueTag("delegate-off");
      View.define(delegateTag, {
        render() {
          return null;
        },
      });
      const container = document.createElement(delegateTag);
      const button = document.createElement("button");
      button.className = "btn";
      container.appendChild(button);
      document.body.appendChild(container);

      let callCount = 0;
      const handler = container.$on(".btn#click", () => {
        callCount++;
      });
      button.click();
      assert.equal(callCount, 1);
      container.$off(".btn#click", handler);
      button.click();
      assert.equal(callCount, 1);
      container.parentNode.removeChild(container);
    });
  });

  describe("emit()", () => {
    it("should dispatch CustomEvent with detail", () => {
      let receivedEvent = null;
      element.addEventListener("my-custom", (e) => {
        receivedEvent = e;
      });
      element.$emit("my-custom", { value: 123 });
      assert.ok(receivedEvent);
      assert.equal(receivedEvent.detail.value, 123);
    });
  });
});

describe("light - Plugin System", () => {
  let original;
  beforeEach(() => { original = View.plugins; });
  afterEach(() => { View.plugins = original; });

  it("gives a class every plugin registered before it", () => {
    View.use({ name: "test-plugin", events: {} });
    const component = View.createClass(getUniqueTag("plugin-merge"), { render() { return null; } });
    assert.ok(component.plugins.some((p) => p.name === "test-plugin"));
  });

  it("replaces a plugin registered again under the same name", () => {
    View.use({ name: "twice", keys: ["first"] });
    View.use({ name: "twice", keys: ["second"] });
    assert.deepEqual(View.plugins.filter((p) => p.name === "twice").map((p) => p.keys), [["second"]]);
  });

  it("keeps a plugin off a class its test refuses", () => {
    View.use({ name: "conditional-plugin", test: ({ component }) => component.tag.includes("allowed"), events: {} });
    const allowed = View.createClass(getUniqueTag("allowed-tag"), { render() { return null; } });
    const blocked = View.createClass(getUniqueTag("blocked-tag"), { render() { return null; } });
    assert.ok(allowed.plugins.some((p) => p.name === "conditional-plugin"));
    assert.equal(blocked.plugins.some((p) => p.name === "conditional-plugin"), false);
  });

  it("runs plugin events on the lifecycle", async () => {
    const events = [];
    View.use({
      name: "lifecycle-plugin",
      events: {
        connected: () => events.push("connected"),
        willUpdate: () => events.push("willUpdate"),
        updated: () => events.push("updated"),
        disconnected: () => events.push("disconnected"),
      },
    });
    const tag = getUniqueTag("plugin-lifecycle");
    View.define(tag, { render() { return null; } });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.remove();
    assert.deepEqual(events, ["connected", "willUpdate", "updated", "disconnected"]);
  });

  it("runs init for a class View.define builds", () => {
    const seen = [];
    View.use({ name: "init-plugin", init: ({ tag }) => { seen.push(tag); } });
    const tag = getUniqueTag("plugin-init");
    View.define(tag, { render() { return null; } });
    assert.deepEqual(seen, [tag]);
  });

  it("takes the definition keys, hooks and properties a plugin declares", () => {
    const ran = [];
    View.use({
      name: "declares",
      keys: ["flavor"],
      hooks: ["ripened"],
      props: (props, definition) => (definition.flavor ? { ...props, ripe: T.boolean({ defaultValue: false }) } : props),
    });
    const tag = getUniqueTag("plugin-declares");
    View.define(tag, {
      mixins: [{ ripened() { ran.push("mixin"); } }],
      flavor: "lime",
      ripened() { ran.push("own"); },
      render() { return null; },
    });
    const el = document.createElement(tag);
    assert.equal("flavor" in el, false);
    assert.equal(el.ripe, false);
    el.$runHook("ripened", {});
    assert.deepEqual(ran, ["mixin", "own"]);
  });
});

describe("light - Query Helpers", () => {
  let element;
  let tag;

  beforeEach(() => {
    tag = getUniqueTag("query-helpers");
    View.define(tag, {
      render() {
        return null;
      },
    });
    element = document.createElement(tag);
    element.innerHTML = `
      <div class="container">
        <span class="item">Item 1</span>
        <span class="item">Item 2</span>
        <span class="item">Item 3</span>
      </div>
    `;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode)
      element.parentNode.removeChild(element);

  });

  describe("$()", () => {
    it("should return querySelector result", () => {
      const container = element.$(".container");
      assert.ok(container);
      assert.equal(container.className, "container");
    });

    it("should return null for non-existent selector", () => {
      const result = element.$(".nonexistent");
      assert.equal(result, null);
    });
  });

  describe("$$()", () => {
    it("should return querySelectorAll result", () => {
      const items = element.$$(".item");
      assert.ok(items);
      assert.equal(items.length, 3);
    });

    it("should return empty NodeList for non-existent selector", () => {
      const result = element.$$(".nonexistent");
      assert.equal(result.length, 0);
    });
  });
});

describe("light - Getters and Setters", () => {
  describe("custom getter/setter", () => {
    it("should support custom getter in definition", () => {
      const tag = getUniqueTag("custom-getter");
      View.define(tag, {
        props: {
          value: { $type: "number", defaultValue: 10 },
        },
        get doubled() {
          return this.value * 2;
        },
        render() {
          return null;
        },
      });
      const el = document.createElement(tag);
      document.body.appendChild(el);
      assert.equal(el.doubled, 20);
      el.value = 5;
      assert.equal(el.doubled, 10);
      el.parentNode.removeChild(el);
    });
  });
});

describe("light - Adoption", () => {
  let originalPrerendered;

  beforeEach(() => {
    originalPrerendered = window.__PRERENDERED__;
  });

  afterEach(() => {
    window.__PRERENDERED__ = originalPrerendered;
  });

  const defineLabeled = (tag, hooks = {}) => {
    View.define(tag, {
      props: {
        label: { $type: "string", defaultValue: "baked" },
      },
      ...hooks,
      render() {
        hooks.onRender?.();
        return html`<button @click=${() => this.$emit("pressed")}>${this.label}</button>`;
      },
    });
  };

  const prerenderMarkup = async (tag) => {
    window.__PRERENDERED__ = false;
    const stage = document.createElement(tag);
    document.body.appendChild(stage);
    await stage.$requestUpdate();
    const markup = stage.innerHTML;
    stage.remove();
    return markup;
  };

  describe("projected hosts adopt in place", () => {
    it("adopts a child host that projected the parent's binding and keeps it live", async () => {
      const childTag = getUniqueTag("adopt-slot-child");
      const parentTag = getUniqueTag("adopt-slot-parent");
      View.define(childTag, { render() { return html`<a><slot></slot></a>`; } });
      View.define(parentTag, {
        props: { label: { $type: "string", defaultValue: "baked" } },
        render() { return element(childTag, {}, this.label); },
      });
      window.__PRERENDERED__ = false;
      const stage = document.createElement(parentTag);
      document.body.appendChild(stage);
      await stage.$requestUpdate();
      await stage.querySelector(childTag).$requestUpdate();
      const markup = stage.innerHTML;
      stage.remove();

      window.__PRERENDERED__ = true;
      const el = document.createElement(parentTag);
      el.innerHTML = markup;
      document.body.appendChild(el);
      await el.$requestUpdate();
      const child = el.querySelector(childTag);
      await child.$requestUpdate();
      const a = child.querySelector("a");
      assert.equal(child.firstChild.data, "$r", "nothing fell out of the slot");
      assert.equal(child.querySelector("slot").textContent, "baked");
      el.label = "fresh";
      await el.$requestUpdate();
      assert.equal(child.querySelector("a"), a);
      assert.equal(child.querySelector("slot").textContent, "fresh");
      el.remove();
    });

    it("client:render keeps the parent's slotted children through the fresh render", async () => {
      const tag = getUniqueTag("adopt-client-render");
      View.define(tag, { render() { return html`<div><slot></slot></div>`; } });
      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      el.setAttribute("client:render", "");
      el.innerHTML = '<!--$r--><div><slot data-assigned=""><b>kept</b></slot></div><!--/r-->';
      const b = el.querySelector("b");
      const served = el.querySelector("div");
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.ok(el.contains(b));
      assert.equal(b.parentNode.localName, "slot");
      assert.ok(b.parentNode.hasAttribute("data-assigned"));
      assert.notEqual(el.querySelector("div"), served);
      el.remove();
    });
  });

  describe("prerendered pages adopt in place", () => {
    it("adopts existing DOM without replacing nodes and with listeners live", async () => {
      const tag = getUniqueTag("adopt-live");
      defineLabeled(tag);
      const markup = await prerenderMarkup(tag);

      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      el.innerHTML = markup;
      const button = el.querySelector("button");
      document.body.appendChild(el);
      let pressed = 0;
      el.addEventListener("pressed", () => pressed++);
      await el.$requestUpdate();
      assert.equal(el.querySelector("button"), button);
      assert.equal(button.textContent, "baked");
      button.click();
      assert.equal(pressed, 1);
      el.remove();
    });

    it("keeps baked content through the first render and updates in place on state change", async () => {
      const tag = getUniqueTag("adopt-stage2");
      defineLabeled(tag);
      const markup = await prerenderMarkup(tag);

      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      el.innerHTML = markup;
      document.body.appendChild(el);
      const button = el.querySelector("button");
      await el.$requestUpdate();
      assert.equal(button.textContent, "baked");
      el.label = "fresh";
      await el.$requestUpdate();
      assert.equal(el.querySelector("button"), button);
      assert.equal(button.textContent, "fresh");
      el.remove();
    });

    it("still runs render() on the adopting first update", async () => {
      const tag = getUniqueTag("adopt-render-runs");
      let renders = 0;
      defineLabeled(tag, { onRender: () => renders++ });
      const markup = await prerenderMarkup(tag);

      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      el.innerHTML = markup;
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.equal(renders, 2);
      el.remove();
    });

    it("still calls firstUpdated and updated when adopting", async () => {
      const tag = getUniqueTag("adopt-hooks");
      let first = false;
      let updated = false;
      defineLabeled(tag, {
        firstUpdated() {
          first = true;
        },
        updated() {
          updated = true;
        },
      });
      const markup = await prerenderMarkup(tag);

      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      el.innerHTML = markup;
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.equal(first, true);
      assert.equal(updated, true);
      el.remove();
    });
  });

  describe("fresh renders stay fresh", () => {
    it("renders normally when the container is empty", async () => {
      const tag = getUniqueTag("adopt-empty");
      defineLabeled(tag);
      window.__PRERENDERED__ = true;
      const el = document.createElement(tag);
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.equal(el.querySelector("button").textContent, "baked");
      el.remove();
    });

    it("renders normally when the page is not prerendered", async () => {
      const tag = getUniqueTag("adopt-off");
      defineLabeled(tag);
      window.__PRERENDERED__ = false;
      const el = document.createElement(tag);
      el.innerHTML = "<div>stale</div>";
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.equal(el.querySelector("button").textContent, "baked");
      el.remove();
    });
  });
});

describe("light - defineComponent", () => {
  describe("identity + field preservation", () => {
    it("returns the same object verbatim (runtime identity)", () => {
      const def = { tag: "x", props: { y: { $type: "number" } } };
      assert.equal(defineComponent(def), def);
    });

    it("preserves all definition fields", () => {
      const def = defineComponent({
        tag: "x", props: { count: { $type: "number" } },
        events: { change: { $type: "object" } },
        style: true,
        render() { return null; },
        connected() {},
      });
      assert.equal(def.tag, "x");
      assert.equal(def.props.count.$type, "number");
      assert.equal(def.events.change.$type, "object");
      assert.equal(def.style, true);
      assert.equal(typeof def.render, "function");
      assert.equal(typeof def.connected, "function");
    });
  });
});

describe("light - mixins", () => {
  describe("property merging", () => {
    it("unions properties across all mixins + component", () => {
      const def = composeDefinition({
        mixins: [{ props: { a: 1 } }, { props: { b: 2 } }],
        tag: "x",
        props: { c: 3 },
      });
      assert.deepEqual(Object.keys(def.props).sort(), ["a", "b", "c"]);
    });

    it("component wins on property collision", () => {
      const def = composeDefinition({ mixins: [{ props: { value: "mixin" } }], tag: "x", props: { value: "component" } });
      assert.equal(def.props.value, "component");
    });

    it("keeps accessors as accessors instead of reading them at compose time", () => {
      const fragment = { get doc() { return this._state.doc; }, props: { a: 1 } };
      const def = composeDefinition({ mixins: [fragment], tag: "x", get own() { return this._state.own; } });
      const desc = Object.getOwnPropertyDescriptor(def, "doc");
      assert.equal(typeof desc.get, "function");
      assert.equal(typeof Object.getOwnPropertyDescriptor(def, "own").get, "function");
      assert.equal(Object.assign(Object.create(def), { _state: { doc: "d", own: "o" } }).doc, "d");
    });

    it("a mixin's own mixins are folded in first", () => {
      const inner = { props: { a: 1 }, connected() { order.push("inner"); } };
      const outer = { mixins: [inner], props: { b: 2 }, connected() { order.push("outer"); } };
      const order = [];
      const def = composeDefinition({ mixins: [outer], tag: "x", props: { c: 3 }, connected() { order.push("own"); } });
      assert.deepEqual(Object.keys(def.props).sort(), ["a", "b", "c"]);
      def.connected.call({});
      assert.deepEqual(order, ["inner", "outer", "own"]);
      assert.equal("mixins" in def, false);
    });
  });

  describe("event merging", () => {
    it("unions events across all mixins + component", () => {
      const def = composeDefinition({ mixins: [{ events: { input: "shared", change: "shared" } }], tag: "x", events: { custom: "comp" } });
      assert.deepEqual(Object.keys(def.events).sort(), ["change", "custom", "input"]);
    });

    it("component wins on event collision", () => {
      const def = composeDefinition({ mixins: [{ events: { change: "mixin-shape" } }], tag: "x", events: { change: "comp-shape" } });
      assert.equal(def.events.change, "comp-shape");
    });
  });

  describe("lifecycle chaining", () => {
    it("runs lifecycle hooks in mixin order then component", () => {
      const order = [];
      const def = composeDefinition({
        mixins: [{ connected() { order.push("A"); } }, { connected() { order.push("B"); } }],
        tag: "x",
        connected() { order.push("OWN"); },
      });
      def.connected.call({});
      assert.deepEqual(order, ["A", "B", "OWN"]);
    });

    it("chains all known lifecycle hook names", () => {
      const hooks = ["connected", "disconnected", "firstUpdated", "updated", "willUpdate"];
      for (const hook of hooks) {
        let mixinCalled = false, ownCalled = false;
        const def = composeDefinition({ mixins: [{ [hook]() { mixinCalled = true; } }], tag: "x", [hook]() { ownCalled = true; } });
        def[hook].call({});
        assert.equal(mixinCalled, true, `mixin's ${hook} ran`);
        assert.equal(ownCalled, true, `component's ${hook} ran`);
      }
    });

    it("awaits an async mixin hook alongside the host's own", async () => {
      const order = [];
      const def = composeDefinition({
        mixins: [{ async connected() { await Promise.resolve(); order.push("mixin"); } }],
        tag: "x",
        connected() { order.push("own"); },
      });
      const result = def.connected.call({});
      assert.equal(typeof result.then, "function");
      await result;
      assert.deepEqual(order, ["own", "mixin"]);
    });

    it("keeps a sync pair of hooks sync", () => {
      const def = composeDefinition({ mixins: [{ connected() { return 1; } }], tag: "x", connected() { return 2; } });
      assert.equal(def.connected.call({}), 2);
    });

    it("doesn't wrap when only one side has the hook", () => {
      const sentinel = function () { return "untouched"; };
      const def = composeDefinition({ mixins: [{ connected: sentinel }], tag: "x", render() {} });
      assert.equal(def.connected, sentinel);
    });

    it("forwards args + this to each chained hook", () => {
      const seen = [];
      const ctx = { name: "ctx" };
      const def = composeDefinition({
        mixins: [{ updated({ changedProps }) { seen.push({ from: "mixin", this: this.name, changedProps }); } }],
        tag: "x",
        updated({ changedProps }) { seen.push({ from: "own", this: this.name, changedProps }); },
      });
      def.updated.call(ctx, { changedProps: new Map() });
      assert.equal(seen.length, 2);
      assert.equal(seen[0].this, "ctx");
      assert.equal(seen[1].this, "ctx");
    });
  });

  describe("method spread", () => {
    it("component method wins on collision", () => {
      const def = composeDefinition({ mixins: [{ handle() { return "mixin"; } }], tag: "x", handle() { return "comp"; } });
      assert.equal(def.handle(), "comp");
    });

    it("mixin-only methods are available", () => {
      const def = composeDefinition({ mixins: [{ mixinOnly() { return "from-mixin"; } }], tag: "x" });
      assert.equal(def.mixinOnly(), "from-mixin");
    });
  });

  describe("no mixins", () => {
    it("returns the definition itself when it lists none", () => {
      const def = { tag: "x", props: { a: 1 } };
      assert.equal(composeDefinition(def), def);
      assert.equal(composeDefinition({ ...def, mixins: [] }).tag, "x");
    });

    it("a defined element composes its mixins", async () => {
      const tag = `mx-composed-${Date.now()}`;
      View.define(tag, defineComponent({
        mixins: [defineMixin({ props: { fromMixin: "m" }, mixinMethod() { return `hello ${this.fromMixin}`; } })],
        tag,
        props: { own: "o" },
        render() { return html`${this.mixinMethod()} ${this.own}`; },
      }));
      const el = document.createElement(tag);
      document.body.appendChild(el);
      await el.$requestUpdate();
      assert.equal(el.textContent.trim(), "hello m o");
      el.remove();
    });
  });
});

describe("light - reactive: false properties", () => {
  let tag;
  let element;

  beforeEach(() => {
    tag = getUniqueTag("reactive-false");
    View.define(tag, {
      props: {
        count: 0,
        handle: T.object({ reactive: false, defaultValue: () => new Map() }),
      },
      render() { return null; },
    });
    element = document.createElement(tag);
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode) element.parentNode.removeChild(element);
  });

  it("is absent from observedAttributes and _attrs", () => {
    assert.ok(!element.constructor.observedAttributes.includes("handle"));
    assert.equal(element.constructor._attrs.handle, undefined);
    assert.equal(element.constructor._storeDefs.handle, undefined);
  });

  it("is a per-instance plain field seeded via cloneDefault", () => {
    const other = document.createElement(tag);
    document.body.appendChild(other);
    assert.ok(element.handle instanceof Map);
    element.handle.set("a", 1);
    assert.equal(other.handle.size, 0);
    other.parentNode.removeChild(other);
  });

  it("mutating it triggers no re-render, while a reactive prop does", async () => {
    let renders = 0;
    const original = element.$requestUpdate.bind(element);
    element.$requestUpdate = (...args) => { renders++; return original(...args); };
    element.handle = new Map([["x", 1]]);
    element.handle.set("y", 2);
    await Promise.resolve();
    assert.equal(renders, 0);
    element.count = 5;
    assert.ok(renders >= 1);
  });

  it("does not throw when a colliding attribute is set", () => {
    element.setAttribute("handle", "whatever");
    assert.ok(element.handle instanceof Map);
  });
});

describe("light - extends chains", () => {
  it("runs every ancestor's connected, oldest first, then the child's", () => {
    const order = [];
    const grand = getUniqueTag("chain-grand");
    const parent = getUniqueTag("chain-parent");
    const child = getUniqueTag("chain-child");
    View.define(grand, { connected() { order.push("grand"); }, render() { return null; } });
    View.define(parent, { extends: grand, connected() { order.push("parent"); }, render() { return null; } });
    View.define(child, { extends: parent, connected() { order.push("child"); }, render() { return null; } });

    const el = document.createElement(child);
    document.body.appendChild(el);
    assert.deepEqual(order, ["grand", "parent", "child"]);
    el.remove();
  });

  it("runs an ancestor's hook for a child that declares none", () => {
    const order = [];
    const base = getUniqueTag("chain-silent-base");
    const leaf = getUniqueTag("chain-silent-leaf");
    View.define(base, { connected() { order.push("base"); }, render() { return null; } });
    View.define(leaf, { extends: base, render() { return null; } });

    const el = document.createElement(leaf);
    document.body.appendChild(el);
    assert.deepEqual(order, ["base"]);
    el.remove();
  });

  it("chains every lifecycle hook the render path drives", async () => {
    const order = [];
    const at = (who) => ({
      connected() { order.push(`${who}:connected`); },
      willUpdate() { order.push(`${who}:willUpdate`); },
      firstUpdated() { order.push(`${who}:firstUpdated`); },
      updated() { order.push(`${who}:updated`); },
      disconnected() { order.push(`${who}:disconnected`); },
      render() { return null; },
    });
    const base = getUniqueTag("chain-all-base");
    const leaf = getUniqueTag("chain-all-leaf");
    View.define(base, at("base"));
    View.define(leaf, { extends: base, ...at("leaf") });

    const el = document.createElement(leaf);
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.remove();
    assert.deepEqual(order, [
      "base:connected", "leaf:connected",
      "base:willUpdate", "leaf:willUpdate",
      "base:firstUpdated", "leaf:firstUpdated",
      "base:updated", "leaf:updated",
      "base:disconnected", "leaf:disconnected",
    ]);
  });

  it("runs a level's hook once per mount, however deep the chain", () => {
    let baseRuns = 0;
    const base = getUniqueTag("chain-once-base");
    const mid = getUniqueTag("chain-once-mid");
    const leaf = getUniqueTag("chain-once-leaf");
    View.define(base, { connected() { baseRuns++; }, render() { return null; } });
    View.define(mid, { extends: base, render() { return null; } });
    View.define(leaf, { extends: mid, render() { return null; } });

    const el = document.createElement(leaf);
    document.body.appendChild(el);
    assert.equal(baseRuns, 1);
    el.remove();
  });

  it("keeps a base's own instances free of the child's hook", () => {
    const order = [];
    const base = getUniqueTag("chain-isolate-base");
    const leaf = getUniqueTag("chain-isolate-leaf");
    View.define(base, { connected() { order.push("base"); }, render() { return null; } });
    View.define(leaf, { extends: base, connected() { order.push("leaf"); }, render() { return null; } });

    const el = document.createElement(base);
    document.body.appendChild(el);
    assert.deepEqual(order, ["base"]);
    el.remove();
  });

  it("keeps a plugin hook and the event of the same name apart", async () => {
    const ran = [];
    const original = View.plugins;
    View.use({ name: "data-hooks", hooks: ["dataLoaded"] });
    const tag = getUniqueTag("hook-vs-event");
    View.define(tag, { dataLoaded({ row }) { ran.push(row); }, render() { return null; } });
    View.plugins = original;

    const el = document.createElement(tag);
    document.body.appendChild(el);
    const heard = [];
    el.addEventListener("dataLoaded", (e) => heard.push(e.detail.row));

    el.$emit("dataLoaded", { row: "from-the-event" });
    assert.deepEqual(ran, [], "a dispatched event never re-enters the definition's hook");
    assert.deepEqual(heard, ["from-the-event"]);

    el.$runHook("dataLoaded", { row: "from-the-hook", instance: el, component: el.constructor });
    assert.deepEqual(ran, ["from-the-hook"], "the hook ran once");
    assert.deepEqual(heard, ["from-the-event"], "and dispatched nothing of its own");
    el.remove();
  });

  it("runs plugin hooks before every definition hook in the chain", () => {
    const order = [];
    const original = View.plugins;
    View.use({
      name: "chain-plugin",
      test: ({ component }) => component.tag.includes("chain-plugin-"),
      events: { connected: () => order.push("plugin") },
    });
    const base = getUniqueTag("chain-plugin-base");
    const leaf = getUniqueTag("chain-plugin-leaf");
    View.define(base, { connected() { order.push("base"); }, render() { return null; } });
    View.define(leaf, { extends: base, connected() { order.push("leaf"); }, render() { return null; } });

    const el = document.createElement(leaf);
    document.body.appendChild(el);
    assert.deepEqual(order, ["plugin", "base", "leaf"]);
    el.remove();

    View.plugins = original;
  });
});

describe("light - light-DOM slots", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve));
  const defineHost = (render, extra = {}) => {
    const tag = getUniqueTag("slot-host");
    View.define(tag, { ...extra, render });
    return tag;
  };
  const mount = async (tag, inner = "") => {
    const el = document.createElement(tag);
    if (inner) el.innerHTML = inner;
    document.body.appendChild(el);
    await el.$requestUpdate();
    return el;
  };
  const isRootStart = (node) => node?.nodeType === 8 && node.data === "$r";

  it("projects a light child into the default slot and parks the fallback", async () => {
    const tag = defineHost(() => html`<div><slot>fallback</slot></div>`);
    const el = await mount(tag, "<p>hi</p>");
    const slot = el.querySelector("slot");
    const p = el.querySelector("p");
    assert.equal(p.parentNode, slot);
    assert.ok(slot.hasAttribute("data-assigned"));
    assert.equal(slot.textContent, "hi");
    assert.ok(isRootStart(el.firstChild), "no light children remain before the root marker");
    el.remove();
  });

  it("routes named and unnamed children to their slots in document order", async () => {
    const tag = defineHost(() => html`<header><slot name="header"></slot></header><main><slot></slot></main>`);
    const el = await mount(tag, '<p>a</p><h1 slot="header">H</h1><p>b</p>');
    assert.equal(el.querySelector("slot[name=header] h1").textContent, "H");
    assert.deepEqual([...el.querySelectorAll("main slot > p")].map((p) => p.textContent), ["a", "b"]);
    el.remove();
  });

  it("shows the fallback while empty, parks it on append, restores the same nodes on removal", async () => {
    const tag = defineHost(() => html`<slot><i>fallback</i></slot>`);
    const el = await mount(tag);
    const slot = el.querySelector("slot");
    const fallback = slot.querySelector("i");
    assert.ok(fallback);
    assert.equal(slot.hasAttribute("data-assigned"), false);
    const span = document.createElement("span");
    span.textContent = "given";
    el.append(span);
    await tick();
    assert.equal(span.parentNode, slot);
    assert.equal(fallback.isConnected, false);
    span.remove();
    await tick();
    assert.equal(slot.querySelector("i"), fallback);
    assert.equal(slot.hasAttribute("data-assigned"), false);
    el.remove();
  });

  it("keeps a parent binding inside slotted content live after projection", async () => {
    const childTag = defineHost(() => html`<b><slot name="a"></slot></b>`);
    const parentTag = getUniqueTag("slot-parent");
    View.define(parentTag, {
      props: { n: 1 },
      render() {
        return element(childTag, {}, html`<span slot="a">${this.n}</span>`);
      },
    });
    const parent = await mount(parentTag);
    const child = parent.querySelector(childTag);
    await child.$requestUpdate();
    const span = child.querySelector("b > slot[name=a] span");
    assert.equal(span.textContent, "1");
    parent.n = 2;
    await parent.$requestUpdate();
    assert.equal(child.querySelector("b > slot[name=a] span"), span);
    assert.equal(span.textContent, "2");
    parent.remove();
  });

  it("reorders a parent keyed list inside a slot without recreating items", async () => {
    const childTag = defineHost(() => html`<ul><slot name="a"></slot></ul>`);
    const parentTag = getUniqueTag("slot-parent");
    View.define(parentTag, {
      props: { items: ["x", "y", "z"] },
      render() {
        return element(childTag, {}, this.items.map((item) => key(item, html`<li slot="a">${item}</li>`)));
      },
    });
    const parent = await mount(parentTag);
    const child = parent.querySelector(childTag);
    await child.$requestUpdate();
    const before = [...child.querySelectorAll("ul > slot > li")];
    assert.deepEqual(before.map((li) => li.textContent), ["x", "y", "z"]);
    parent.items = ["z", "y", "x"];
    await parent.$requestUpdate();
    const after = [...child.querySelectorAll("ul > slot > li")];
    assert.deepEqual(after.map((li) => li.textContent), ["z", "y", "x"]);
    assert.equal(after[0], before[2]);
    assert.equal(after[2], before[0]);
    parent.remove();
  });

  it("carries slotted content across a template swap", async () => {
    const tag = defineHost(
      function () {
        return this.link ? html`<a><slot></slot></a>` : html`<button><slot></slot></button>`;
      },
      { props: { link: false } },
    );
    const el = await mount(tag, "<i>x</i>");
    const i = el.querySelector("i");
    assert.ok(el.querySelector("button > slot > i"));
    el.link = true;
    await el.$requestUpdate();
    assert.equal(el.querySelector("a > slot > i"), i);
    assert.equal(el.querySelector("button"), null);
    el.remove();
  });

  it("re-assigns a child whose slot attribute changes", async () => {
    const tag = defineHost(() => html`<slot name="a"></slot><slot name="b"></slot>`);
    const el = await mount(tag, '<i slot="a">x</i>');
    const i = el.querySelector("i");
    assert.equal(i.parentNode, el.querySelector("slot[name=a]"));
    i.setAttribute("slot", "b");
    await tick();
    assert.equal(i.parentNode, el.querySelector("slot[name=b]"));
    assert.equal(el.querySelector("slot[name=a]").hasAttribute("data-assigned"), false);
    el.remove();
  });

  it("projects a child appended imperatively", async () => {
    const tag = defineHost(() => html`<slot name="b"></slot>`);
    const el = await mount(tag);
    const i = document.createElement("i");
    i.slot = "b";
    el.append(i);
    await tick();
    assert.equal(i.parentNode, el.querySelector("slot[name=b]"));
    el.remove();
  });

  it("dispatches slotchange on the slot, once per change, without bubbling to an outer host", async () => {
    let outerCount = 0;
    let innerCount = 0;
    const innerTag = defineHost(() => html`<div><slot></slot></div>`, {
      firstUpdated() {
        this.querySelector("slot").addEventListener("slotchange", () => innerCount++);
      },
    });
    const outerTag = defineHost(() => html`<section><slot></slot></section>`, {
      firstUpdated() {
        this.querySelector("slot").addEventListener("slotchange", () => outerCount++);
      },
    });
    const outer = await mount(outerTag, `<${innerTag}><i>x</i></${innerTag}>`);
    const inner = outer.querySelector(innerTag);
    await inner.$requestUpdate();
    await tick();
    assert.equal(outerCount, 1);
    assert.equal(innerCount, 1);
    outer.$project();
    await tick();
    assert.equal(outerCount, 1);
    inner.append(document.createElement("b"));
    await tick();
    assert.equal(innerCount, 2);
    assert.equal(outerCount, 1);
    outer.remove();
  });

  it("forwards a slot through a nested host", async () => {
    const innerTag = defineHost(() => html`<div><slot name="b"></slot></div>`);
    const outerTag = defineHost(() => element(innerTag, {}, html`<slot name="a" slot="b"></slot>`));
    const outer = await mount(outerTag, '<i slot="a">x</i>');
    const inner = outer.querySelector(innerTag);
    await inner.$requestUpdate();
    const i = outer.querySelector("i");
    assert.ok(inner.querySelector("div > slot[name=b] slot[name=a]"), "the outer slot sits inside the inner slot");
    assert.equal(i.parentNode, inner.querySelector("slot[name=a]"));
    outer.remove();
  });

  it("holds a child naming an unknown slot unrendered until that slot renders", async () => {
    const tag = defineHost(
      function () {
        return this.extra ? html`<slot name="a"></slot><slot name="nope"></slot>` : html`<slot name="a"></slot>`;
      },
      { props: { extra: false } },
    );
    const el = await mount(tag, '<i slot="nope">x</i>');
    const i = el.querySelector("i");
    const holder = el.querySelector(":scope > unslotted");
    assert.equal(i.parentNode, holder);
    assert.ok(holder.hidden);
    assert.equal(i.getClientRects().length, 0);
    assert.ok(isRootStart(holder.nextSibling));
    el.extra = true;
    await el.$requestUpdate();
    assert.equal(i.parentNode, el.querySelector("slot[name=nope]"));
    assert.equal(el.querySelector(":scope > unslotted"), null);
    el.remove();
  });

  it("moves a slotted view with moveBefore, firing neither disconnect nor connect", { skip: typeof Element.prototype.moveBefore !== "function" }, async () => {
    let connected = 0;
    let disconnected = 0;
    const childTag = defineHost(() => html`child`, {
      connected() { connected++; },
      disconnected() { disconnected++; },
    });
    const hostTag = defineHost(() => html`<div><slot></slot></div>`);
    const host = document.createElement(hostTag);
    host.append(document.createElement(childTag));
    document.body.appendChild(host);
    assert.equal(connected, 1);
    await host.$requestUpdate();
    assert.ok(host.querySelector("div > slot > " + childTag));
    assert.equal(connected, 1);
    assert.equal(disconnected, 0);
    host.remove();
  });

  it("moves a slotted view with insertBefore when moveBefore is absent, still firing neither disconnect nor connect", async () => {
    const proto = /** @type {any} */ (Element.prototype);
    const saved = proto.moveBefore;
    proto.moveBefore = undefined;
    try {
      let connected = 0;
      let disconnected = 0;
      let renders = 0;
      const childTag = getUniqueTag("slot-host");
      View.define(childTag, {
        props: { label: "a" },
        connected() { connected++; },
        disconnected() { disconnected++; },
        render() {
          renders++;
          return html`<i>${this.label}</i>`;
        },
      });
      const hostTag = defineHost(() => html`<div><slot></slot></div>`);
      const host = document.createElement(hostTag);
      const child = document.createElement(childTag);
      host.append(child);
      document.body.appendChild(host);
      assert.equal(connected, 1);
      await host.$requestUpdate();
      if (child.$updatePromise) await child.$updatePromise;
      assert.equal(child.parentNode, host.querySelector("div > slot"));
      assert.equal(connected, 1);
      assert.equal(disconnected, 0);
      assert.equal(renders, 1);
      child.label = "b";
      await child.$updatePromise;
      assert.equal(child.querySelector("i").textContent, "b", "the moved view still reacts to its state");
      assert.equal(renders, 2);
      host.remove();
      assert.equal(disconnected, 1, "a real removal still disconnects");
    } finally {
      proto.moveBefore = saved;
    }
  });

  it("gives default content to the outer of two nested default slots", async () => {
    const tag = defineHost(() => html`<slot part="x-body"><slot>fb</slot></slot>`);
    const empty = await mount(tag);
    assert.equal(empty.querySelector("slot slot").textContent, "fb");
    empty.remove();
    const filled = await mount(tag, "<i>x</i>");
    assert.ok(filled.querySelector("slot[part] > i"));
    assert.equal(filled.querySelector("slot slot"), null);
    filled.remove();
  });

  it("projects into a slot rendered through element()", async () => {
    const tag = defineHost(() => element("div", {}, html`<slot></slot>`));
    const el = await mount(tag, "<i>x</i>");
    assert.ok(el.querySelector("div > slot > i"));
    el.remove();
  });

  it("projects into a slot a thunk renders later, without a host update", async () => {
    const open = signal(false);
    const tag = defineHost(() => html`<div>${() => (open.value ? html`<slot></slot>` : null)}</div>`);
    const el = await mount(tag, "<i>x</i>");
    const i = el.querySelector("i");
    assert.equal(i.parentNode, el);
    open.value = true;
    await tick();
    assert.ok(el.querySelector("div > slot > i"));
    el.remove();
  });

  it("follows a bound slot name", async () => {
    const tag = defineHost(
      function () {
        return html`<slot name=${this.which}></slot>`;
      },
      { props: { which: "a" } },
    );
    const el = await mount(tag, '<i slot="a">x</i>');
    const i = el.querySelector("i");
    assert.equal(i.parentNode, el.querySelector("slot"));
    el.which = "b";
    await el.$requestUpdate();
    await tick();
    assert.equal(i.parentNode, el.querySelector(":scope > unslotted"));
    assert.equal(el.querySelector("slot").hasAttribute("data-assigned"), false);
    el.remove();
  });

  it("returns slotted content to the light area and restores the fallback on disposeTree", async () => {
    const tag = defineHost(() => html`<slot>fb</slot>`);
    const el = await mount(tag, "<i>x</i>");
    const i = el.querySelector("i");
    disposeTree(el);
    assert.equal(el.firstChild, i);
    assert.ok(isRootStart(i.nextSibling));
    assert.equal(el.querySelector("slot").textContent, "fb");
    assert.equal(el.$slotParts.size, 0);
    el.remove();
  });
});

describe("light - update scheduling", () => {
  const frames = (n) => new Promise((resolve) => {
    let left = n;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

  const defineChain = () => {
    const tag = getUniqueTag("chain");
    View.define(tag, {
      props: { depth: 0, value: "" },
      render() {
        if (this.depth > 0) return element(tag, { ".depth": this.depth - 1, ".value": this.value });
        return html`<span>${this.value}</span>`;
      },
    });
    return tag;
  };

  it("renders a nested tree in the flush that renders its root, on mount and on change", async () => {
    const root = document.createElement(defineChain());
    root.depth = 8;
    root.value = "a";
    document.body.appendChild(root);
    await root.$requestUpdate();
    assert.equal(root.querySelector("span")?.textContent, "a");
    root.value = "b";
    await root.$requestUpdate();
    assert.equal(root.querySelector("span")?.textContent, "b");
    root.remove();
  });

  it("renders a parent before a child dirtied in the same tick, and the child once", async () => {
    const childTag = getUniqueTag("order-child");
    const parentTag = getUniqueTag("order-parent");
    let childRenders = 0;
    View.define(childTag, {
      props: { label: "" },
      render() {
        childRenders++;
        return html`<i>${this.label}</i>`;
      },
    });
    View.define(parentTag, {
      props: { label: "x" },
      render() { return element(childTag, { ".label": this.label }); },
    });
    const parent = document.createElement(parentTag);
    document.body.appendChild(parent);
    await parent.$requestUpdate();
    await frames(2);
    const child = parent.querySelector(childTag);
    childRenders = 0;
    child.label = "from-child";
    parent.label = "from-parent";
    await parent.$requestUpdate();
    await frames(2);
    assert.equal(child.querySelector("i").textContent, "from-parent");
    assert.equal(childRenders, 1);
    parent.remove();
  });

  it("skips the update of an element removed before its turn, and updates it when it returns", async () => {
    const tag = getUniqueTag("detached");
    let renders = 0;
    View.define(tag, { props: { n: 0 }, render() { renders++; return html`${this.n}`; } });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    el.remove();
    await frames(2);
    assert.equal(renders, 0);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(renders, 1);
    el.remove();
  });

  it("keeps updating after a render throws, and reports the error", async () => {
    const tag = getUniqueTag("throws-once");
    View.define(tag, {
      props: { n: 0, fail: false },
      render() {
        if (this.fail) throw new Error("render failed");
        return html`<span>${this.n}</span>`;
      },
    });
    const reported = [];
    const original = globalThis.reportError;
    globalThis.reportError = (error) => reported.push(error);
    const el = document.createElement(tag);
    try {
      document.body.appendChild(el);
      await el.$requestUpdate();
      el.fail = true;
      await el.$requestUpdate();
      el.fail = false;
      el.n = 5;
      await el.$requestUpdate();
      assert.equal(el.querySelector("span")?.textContent, "5");
      assert.deepEqual(reported.map((error) => error.message), ["render failed"]);
    } finally {
      globalThis.reportError = original;
      el.remove();
    }
  });

  it("reports a failed update once and waits for the next change instead of retrying every frame", async () => {
    const tag = getUniqueTag("throws-in-will-update");
    let attempts = 0;
    View.define(tag, {
      props: { n: 0, fail: false },
      willUpdate() {
        if (!this.fail) return;
        attempts++;
        throw new Error("willUpdate failed");
      },
      render() { return html`<span>${this.n}</span>`; },
    });
    const reported = [];
    const original = globalThis.reportError;
    globalThis.reportError = (error) => reported.push(error);
    const el = document.createElement(tag);
    try {
      document.body.appendChild(el);
      await el.$requestUpdate();
      el.fail = true;
      await frames(5);
      assert.equal(attempts, 1);
      assert.equal(reported.length, 1);
      el.fail = false;
      el.n = 3;
      await el.$requestUpdate();
      assert.equal(el.querySelector("span")?.textContent, "3");
    } finally {
      globalThis.reportError = original;
      el.remove();
    }
  });

  it("renders a property derived in willUpdate in the same update, once", async () => {
    const tag = getUniqueTag("derive");
    let renders = 0;
    const seen = [];
    View.define(tag, {
      props: { items: [], filtered: [] },
      willUpdate() { this.filtered = this.items.filter((x) => x > 1); },
      updated({ changedProps }) { seen.push([...changedProps.keys()].sort().join(",")); },
      render() {
        renders++;
        return html`<i>${this.filtered.length}</i>`;
      },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    await frames(2);
    renders = 0;
    seen.length = 0;
    el.items = [1, 2, 3];
    await el.$requestUpdate();
    await frames(5);
    assert.equal(el.querySelector("i").textContent, "2");
    assert.equal(renders, 1);
    assert.deepEqual(seen, ["filtered,items"]);
    el.remove();
  });

  it("drops a reflected attribute when its string property is emptied or unset", async () => {
    const tag = getUniqueTag("reflect-empty");
    View.define(tag, {
      props: { variant: "primary" },
      render() { return null; },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.variant = "danger";
    assert.equal(el.getAttribute("variant"), "danger");
    el.variant = "";
    assert.equal(el.hasAttribute("variant"), false);
    el.variant = "primary";
    el.variant = undefined;
    assert.equal(el.hasAttribute("variant"), false);
    el.remove();
  });
});

describe("light - definitions stay the author's", () => {
  it("leaves a definition's object property untouched when merging it over a base", () => {
    const base = View.createClass(getUniqueTag("merge-base"), {
      props: { theme: T.object({ props: { a: T.string() } }) },
      render() { return null; },
    });
    const own = { theme: T.object({ props: { c: T.string() } }) };
    const inner = own.theme.props;
    const child = View.createClass(getUniqueTag("merge-child"), { props: own, render() { return null; } }, base);
    assert.deepEqual(Object.keys(child.properties.theme.props).sort(), ["a", "c"]);
    assert.equal(own.theme.props, inner);
    assert.deepEqual(Object.keys(own.theme.props), ["c"]);
  });

  it("refuses a function where a definition belongs, naming the tag", () => {
    const tag = getUniqueTag("function-def");
    assert.throws(() => View.createClass(tag, () => ({ render() { return null; } })), new RegExp(tag));
  });
});

describe("light - View.define's shapes", () => {
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  it("answers the class for a tag it registers in the call", () => {
    const tag = getUniqueTag("shape-class");
    const C = View.define(tag, { render() { return null; } });
    assert.equal(customElements.get(tag), C);
    assert.equal(View.define(tag, View.components.get(tag).definition), C, "the same definition again answers the same class");
  });

  it("keeps the props beside the tag, typed on this and reflected from attributes", async () => {
    const tag = getUniqueTag("shape-props");
    View.define(tag, { count: 0, label: "Count" }, {
      bump() { this.count += 2; },
      render() { return html`<b>${this.label}: ${this.count}</b>`; },
    });
    const el = document.createElement(tag);
    el.setAttribute("count", "3");
    document.body.append(el);
    await nextFrame();
    assert.equal(el.querySelector("b").textContent, "Count: 3");
    el.bump();
    await nextFrame();
    assert.equal(el.count, 5);
    el.remove();
  });

  it("takes a function as the render, called with the element", async () => {
    const tag = getUniqueTag("shape-fn");
    const seen = [];
    View.define(tag, { count: 1 }, (el) => { seen.push(el); return html`<i>${el.count}</i>`; });
    const el = document.createElement(tag);
    document.body.append(el);
    await nextFrame();
    assert.equal(el.querySelector("i").textContent, "1");
    assert.equal(seen[0], el);
    const bare = getUniqueTag("shape-bare");
    View.define(bare, (host) => html`<u>${host.tagName.toLowerCase()}</u>`);
    const other = document.createElement(bare);
    document.body.append(other);
    await nextFrame();
    assert.equal(other.querySelector("u").textContent, bare);
    el.remove();
    other.remove();
  });

  it("hands a method render the element too", async () => {
    const tag = getUniqueTag("shape-arg");
    View.define(tag, { n: 4 }, { render(el) { return html`<s>${el.n}${this.n}</s>`; } });
    const el = document.createElement(tag);
    document.body.append(el);
    await nextFrame();
    assert.equal(el.querySelector("s").textContent, "44");
    el.remove();
  });

  it("refuses props inside the definition when they come as an argument", () => {
    assert.throws(() => View.define(getUniqueTag("shape-twice"), { a: 1 }, { props: { b: 2 }, render() { return null; } }), /second argument/);
  });

  it("refuses the key's old name on a definition, a mixin and a descriptor", () => {
    assert.throws(() => View.define(getUniqueTag("shape-old"), { properties: { a: 1 }, render() { return null; } }), /"properties" is not a definition key.*"props"/);
    assert.throws(() => View.define(getUniqueTag("shape-old-mixin"), { mixins: [{ properties: { a: 1 } }], render() { return null; } }), /"props"/);
    assert.throws(() => T.object({ properties: { a: T.string() } }) && View.createClass(getUniqueTag("shape-old-desc"), { props: { o: T.object({ properties: { a: T.string() } }) } }), /"props"/);
  });

  it("answers a promise of the class while the base is awaited", async () => {
    const base = getUniqueTag("shape-base");
    const child = getUniqueTag("shape-child");
    const pending = View.define(child, { extends: base, render() { return html`<em>child</em>`; } });
    assert.equal(typeof pending.then, "function");
    assert.equal(customElements.get(child), undefined);
    const B = View.define(base, { render() { return null; } });
    const C = await pending;
    assert.equal(customElements.get(child), C);
    assert.equal(Object.getPrototypeOf(C), B);
  });
});

describe("light - a class with signal fields", () => {
  const frames = (n) => new Promise((resolve) => {
    let left = n;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

  it("re-renders when a signal its render read changes, and resolves the update it scheduled", async () => {
    const tag = getUniqueTag("class-counter");
    let renders = 0;
    class Counter extends View {
      count = signal(0);
      render() {
        renders++;
        return html`<b>${this.count.value}</b>`;
      }
    }
    assert.equal(View.register(tag, Counter), Counter);
    assert.equal(Counter.tag, tag);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.querySelector("b").textContent, "0");
    el.count.value = 1;
    assert.ok(el.$updatePromise, "the signal write scheduled an update");
    await el.$requestUpdate();
    assert.equal(el.querySelector("b").textContent, "1");
    assert.equal(renders, 2);
    el.remove();
  });

  it("recommits one part for a thunk without re-rendering", async () => {
    const tag = getUniqueTag("class-thunk");
    let renders = 0;
    class Label extends View {
      text = signal("a");
      render() {
        renders++;
        return html`<i>${() => this.text.value}</i>`;
      }
    }
    View.register(tag, Label);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.querySelector("i").textContent, "a");
    el.text.value = "b";
    await frames(1);
    assert.equal(el.querySelector("i").textContent, "b");
    assert.equal(renders, 1);
    el.remove();
  });

  it("runs the lifecycle methods in order, hands the update hooks the changed props, and runs owned teardowns on remove", async () => {
    const tag = getUniqueTag("class-hooks");
    const seen = [];
    class Hooked extends View {
      n = signal(0);
      connected() {
        seen.push("connected");
        this.$own(() => seen.push("teardown"));
      }
      willUpdate(changed) {
        seen.push(`willUpdate:${[...changed.keys()].join(",")}`);
      }
      firstUpdated(changed) {
        seen.push(`firstUpdated:${changed instanceof Map}`);
      }
      updated(changed) {
        seen.push(`updated:${changed instanceof Map}`);
      }
      disconnected() {
        seen.push("disconnected");
      }
      render() {
        return html`<span>${this.n.value}</span>`;
      }
    }
    View.register(tag, Hooked);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.n.value = 1;
    await el.$requestUpdate();
    el.remove();
    assert.deepEqual(seen, [
      "connected",
      "willUpdate:",
      "firstUpdated:true",
      "updated:true",
      "willUpdate:",
      "updated:true",
      "teardown",
      "disconnected",
    ]);
  });

  it("stops following its signals once removed, and follows them again when it returns", async () => {
    const tag = getUniqueTag("class-detached");
    let renders = 0;
    class Gone extends View {
      n = signal(0);
      render() {
        renders++;
        return html`${this.n.value}`;
      }
    }
    View.register(tag, Gone);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    el.remove();
    el.n.value = 1;
    await frames(2);
    assert.equal(renders, 1);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.textContent, "1");
    el.n.value = 2;
    await el.$requestUpdate();
    assert.equal(el.textContent, "2");
    assert.equal(renders, 3);
    el.remove();
  });

  it("leaves a defined component's render untracked: its properties drive its updates", async () => {
    const tag = getUniqueTag("defined-untracked");
    const outside = signal(0);
    let renders = 0;
    View.define(tag, {
      props: { label: "x" },
      render() {
        renders++;
        return html`<span>${this.label}:${outside.value}</span>`;
      },
    });
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.$ctor.$trackRender, false);
    outside.value = 1;
    await frames(2);
    assert.equal(renders, 1);
    el.label = "y";
    await el.$requestUpdate();
    assert.equal(el.querySelector("span").textContent, "y:1");
    el.remove();
  });
});
