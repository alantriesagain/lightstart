/**
 * `<lc-form>` before it grows.
 *
 * 444 lines, thirteen renderer branches, a `typeHandlers` escape hatch and a
 * `cmsType` registry hop, and the only cover anywhere was three branches
 * asserted from @bootstrapp/admin's own test. This pins the public surface
 * four consumers reach through `querySelector` (`submit`, `collectFormData`,
 * `serialize`, `deserialize`, `setErrors`, `clearErrors`) so the engine work
 * that follows has something to break.
 *
 * Three of these cases pin a bug rather than a behaviour, each marked. They
 * are here so the fix shows up as a diff in this file rather than as silence.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import formDef from "./form.js";
import inputDef from "./input.js";
import selectDef from "./select.js";
import textareaDef from "./textarea.js";
import checkboxDef from "./checkbox.js";
import fileUploadDef from "./file-upload.js";
import linkDef from "../display/link.js";
import iconDef from "../display/icon.js";
import buttonDef from "../display/button.js";
import labelDef from "./label.js";
import { registerFormFieldRenderer } from "./field-renderers.js";

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const CONTROL_TAGS = "lc-input, lc-select, lc-textarea, lc-checkbox, lc-switch, lc-file-upload";
/** @param {Element} el */
const controlNames = (el) => [...el.querySelectorAll(CONTROL_TAGS)].map((c) => c.getAttribute("name"));
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const press = (/** @type {Element} */ el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const until = async (get, what) => {
  for (let i = 0; i < 60; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

const define = (tag, def) => {
  if (!customElements.get(tag)) View.define(tag, def);
};

describe("lc-form", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];

  before(() => {
    define("lc-label", labelDef);
    define("lc-input", inputDef);
    define("lc-select", selectDef);
    define("lc-textarea", textareaDef);
    define("lc-checkbox", checkboxDef);
    define("lc-file-upload", fileUploadDef);
    define("lc-link", linkDef);
    define("lc-icon", iconDef);
    define("lc-button", buttonDef);
    define("lc-form", formDef);
  });

  after(() => {
    for (const el of mounted) el.remove();
  });

  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };

  describe("what it renders", () => {
    it("draws one control per field, in the order the list gives", async () => {
      const el = await mount({
        fields: [
          { name: "title", label: "Title", type: "text" },
          { name: "notes", label: "Notes", type: "textarea" },
          { name: "count", label: "Count", type: "number" },
          { name: "live", label: "Live", type: "checkbox" },
        ],
      });
      assert.deepEqual(controlNames(el), ["title", "notes", "count", "live"]);
      assert.equal(el.querySelector('[name="notes"]').tagName.toLowerCase(), "lc-textarea");
      assert.equal(el.querySelector('[name="live"]').tagName.toLowerCase(), "lc-checkbox");
    });

    it("maps every input-shaped type onto its own input type", async () => {
      const types = ["date", "datetime-local", "time", "email", "url", "password", "tel", "number"];
      const el = await mount({ fields: types.map((type) => ({ name: type, label: type, type })) });
      for (const type of types)
        assert.equal(el.querySelector(`[name="${type}"]`).getAttribute("type"), type, type);
    });

    it("an unknown type falls back to a text input rather than rendering nothing", async () => {
      const el = await mount({ fields: [{ name: "mystery", label: "Mystery", type: "carrier-pigeon" }] });
      const control = el.querySelector('[name="mystery"]');
      assert.equal(control.tagName.toLowerCase(), "lc-input");
      assert.equal(control.getAttribute("type"), "text");
    });

    it("a select normalizes both option shapes", async () => {
      const el = await mount({
        fields: [{ name: "kind", label: "Kind", type: "select", options: ["a", { value: "b", label: "Bee" }] }],
      });
      assert.deepEqual(el.querySelector('[name="kind"]').options, [
        { value: "a", label: "a" },
        { value: "b", label: "Bee" },
      ]);
    });

    it("setErrors takes what a rejection carries, and nothing clears them", async () => {
      const el = await mount({ fields: [{ name: "title", label: "Title", type: "text" }] });
      el.setErrors({ title: "Title is required" });
      await frame();
      assert.equal(el.querySelector(".form-error").textContent.trim(), "Title is required");
      el.setErrors(null);
      await frame();
      assert.equal(el.querySelector(".form-error"), null);
      el.setErrors(undefined);
      assert.deepEqual(el.errors, {});
    });

    it("an error draws beside its field and clears on demand", async () => {
      const el = await mount({ fields: [{ name: "title", label: "Title", type: "text" }] });
      el.setErrors({ title: "Title is required" });
      await frame();
      assert.equal(el.querySelector(".form-error").textContent.trim(), "Title is required");
      assert.ok(el.querySelector(".has-error"));
      el.clearErrors();
      await frame();
      assert.equal(el.querySelector(".form-error"), null);
    });
  });

  describe("collectFormData", () => {
    it("reads text, textarea and select values off the controls", async () => {
      const el = await mount({
        fields: [
          { name: "title", label: "Title", type: "text" },
          { name: "notes", label: "Notes", type: "textarea" },
        ],
        data: { title: "A place", notes: "some notes" },
      });
      assert.deepEqual(el.collectFormData(), { title: "A place", notes: "some notes" });
    });

    it("an empty value is null, not an empty string", async () => {
      const el = await mount({ fields: [{ name: "title", label: "Title", type: "text" }], data: {} });
      assert.deepEqual(el.collectFormData(), { title: null });
    });

    it("a checkbox is always a boolean, and a number is always a number or null", async () => {
      const el = await mount({
        fields: [
          { name: "live", label: "Live", type: "checkbox" },
          { name: "count", label: "Count", type: "number" },
        ],
        data: { live: true, count: 3 },
      });
      const collected = el.collectFormData();
      assert.equal(collected.live, true);
      assert.equal(collected.count, 3);

      const empty = await mount({
        fields: [
          { name: "live", label: "Live", type: "checkbox" },
          { name: "count", label: "Count", type: "number" },
        ],
        data: {},
      });
      assert.deepEqual(empty.collectFormData(), { live: false, count: null });
    });

    it("a cmsType field is read back off .data, since its widget is not a control", async () => {
      registerFormFieldRenderer("swatch", (field, value, onChange, html) =>
        html`<button type="button" @click=${() => onChange("#ff0000")}>${String(value ?? "")}</button>`);
      const el = await mount({
        fields: [{ name: "colour", label: "Colour", type: "text", cmsType: "swatch" }],
        data: { colour: "#00ff00" },
      });
      assert.deepEqual(el.collectFormData(), { colour: "#00ff00" });
      el.querySelector("button").click();
      await frame();
      assert.deepEqual(el.collectFormData(), { colour: "#ff0000" });
    });

    it("a typeHandlers widget writes .data, and collectFormData reads it back", async () => {
      const el = await mount({
        fields: [{ name: "when", label: "When", type: "fancy-date" }],
        typeHandlers: {
          "fancy-date": {
            render: (field, value, onChange) => {
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = String(value ?? "");
              button.addEventListener("click", () => onChange("2026-09-10"));
              return button;
            },
          },
        },
        data: {},
      });
      el.querySelector("button").click();
      await frame();
      assert.equal(el.data.when, "2026-09-10", "the widget did write");
      assert.deepEqual(el.collectFormData(), { when: "2026-09-10" }, "and the value survives to the payload");
    });

    it("multi-select keeps every selected value, and an empty one is an empty list", async () => {
      const themes = {
        name: "themes", label: "Themes", type: "multi-select",
        options: [{ value: "food", label: "Food" }, { value: "beach", label: "Beach" }, { value: "art", label: "Art" }],
      };
      const el = await mount({ fields: [themes], data: { themes: ["food", "beach"] } });
      const select = el.querySelector('[name="themes"]');
      assert.equal(select.multiple, true);
      assert.deepEqual(select.value, ["food", "beach"]);
      assert.deepEqual(el.collectFormData().themes, ["food", "beach"]);

      const none = await mount({ fields: [themes], data: {} });
      assert.deepEqual(none.collectFormData().themes, []);
    });

    it("a multi-select draws each selected option as a tag and collects them as a list", async () => {
      const el = await mount({
        fields: [{
          name: "themes", label: "Themes", type: "multi-select",
          options: [{ value: "food", label: "Food" }, { value: "beach", label: "Beach" }, { value: "art", label: "Art" }],
        }],
        data: { themes: ["food", "art"] },
      });
      const tags = await until(() => {
        const found = el.querySelectorAll('lc-select[name="themes"] lc-tag');
        return found.length === 2 ? found : null;
      }, "the selected tags");
      assert.deepEqual([...tags].map((tag) => tag.dataset.value), ["food", "art"]);
      assert.deepEqual(el.querySelector('[name="themes"]').value, ["food", "art"]);
      assert.deepEqual(el.collectFormData().themes, ["food", "art"]);
    });
  });

  describe("serialize", () => {
    it("a numeric string becomes a number and a boolean string becomes a boolean", async () => {
      const el = await mount({
        fields: [
          { name: "count", label: "Count", type: "number" },
          { name: "live", label: "Live", type: "checkbox" },
        ],
      });
      assert.deepEqual(el.serialize({ count: "42", live: "true" }), { count: 42, live: true });
      assert.deepEqual(el.serialize({ count: "", live: "0" }), { count: null, live: false });
    });

    it("a textarea named for json is parsed, and unparseable text is left alone", async () => {
      const el = await mount({ fields: [{ name: "jsonBlob", label: "Blob", type: "textarea" }] });
      assert.deepEqual(el.serialize({ jsonBlob: '{"a":1}' }), { jsonBlob: { a: 1 } });
      assert.deepEqual(el.serialize({ jsonBlob: "not json" }), { jsonBlob: "not json" });
    });

    it("a typeHandler wins over the built-in branch for that type", async () => {
      const el = await mount({
        fields: [{ name: "count", label: "Count", type: "number" }],
        typeHandlers: { number: { serialize: (v) => `<${v}>` } },
      });
      assert.deepEqual(el.serialize({ count: "42" }), { count: "<42>" });
    });

    it("null and undefined are left where they are", async () => {
      const el = await mount({ fields: [{ name: "count", label: "Count", type: "number" }] });
      assert.deepEqual(el.serialize({ count: null }), { count: null });
      assert.deepEqual(el.serialize({}), {});
    });
  });

  describe("deserialize", () => {
    it("an object in a textarea comes back as indented json", async () => {
      const el = await mount({ fields: [{ name: "meta", label: "Meta", type: "textarea" }] });
      assert.equal(el.deserialize({ meta: { a: 1 } }).meta, '{\n  "a": 1\n}');
    });

    it("a date shows the day it is where the person is, at any hour", async () => {
      const el = await mount({ fields: [{ name: "day", label: "Day", type: "date" }] });
      const day = (value) => el.deserialize({ day: value }).day;

      assert.equal(day("2026-01-15"), "2026-01-15", "a date-only string carries no zone, so it is already the answer");
      assert.equal(day("2026-01-15T22:00"), "2026-01-15", "so is a wall-clock string");
      for (const hour of [0, 2, 12, 22, 23])
        assert.equal(day(new Date(2026, 0, 15, hour, 30, 0)), "2026-01-15", `local ${hour}:30 is still the 15th`);
      assert.equal(day(new Date(2026, 0, 15, 22, 0, 0).getTime()), "2026-01-15", "an epoch instant is read in the local zone");
      assert.equal(day("nonsense"), "nonsense", "an unparseable value is left alone rather than shown as NaN");
    });

    it("a datetime-local shows the wall clock, not the UTC one", async () => {
      const el = await mount({ fields: [{ name: "at", label: "At", type: "datetime-local" }] });
      const at = (value) => el.deserialize({ at: value }).at;
      assert.equal(at(new Date(2026, 0, 15, 22, 5, 0)), "2026-01-15T22:05");
      assert.equal(at(new Date(2026, 0, 15, 0, 0, 0)), "2026-01-15T00:00");
      assert.equal(at("2026-01-15T22:05"), "2026-01-15T22:05", "a wall-clock string is left where it is");
      assert.equal(at("2026-01-15"), "2026-01-15T00:00", "a date-only string starts the day");
    });

    it("a typeHandler for a type skips the built-in branch entirely", async () => {
      const el = await mount({
        fields: [{ name: "day", label: "Day", type: "date" }],
        typeHandlers: { date: { serialize: (v) => v } },
      });
      const raw = new Date(2026, 0, 15, 2, 0, 0);
      assert.equal(el.deserialize({ day: raw }).day, raw, "no deserialize means the value passes through untouched");
    });

    it("an absent key stays absent rather than becoming null", async () => {
      const el = await mount({ fields: [{ name: "day", label: "Day", type: "date" }] });
      assert.deepEqual(el.deserialize({}), {});
    });
  });

  describe("submit", () => {
    it("emits form-submit with the serialized payload", async () => {
      const el = await mount({
        fields: [
          { name: "title", label: "Title", type: "text" },
          { name: "count", label: "Count", type: "number" },
        ],
        data: { title: "A place", count: 3 },
      });
      /** @type {unknown} */
      let payload;
      el.addEventListener("form-submit", (e) => { payload = e.detail; });
      el.submit();
      await frame();
      assert.deepEqual(payload, { title: "A place", count: 3 });
    });

    it("submitting clears the errors already shown", async () => {
      const el = await mount({ fields: [{ name: "title", label: "Title", type: "text" }], data: { title: "x" } });
      el.setErrors({ title: "Title is required" });
      await frame();
      assert.ok(el.querySelector(".form-error"));
      el.submit();
      await frame();
      assert.equal(el.querySelector(".form-error"), null);
    });
  });
});

describe("lc-form: the field grammar", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];
  after(() => {
    for (const el of mounted) el.remove();
  });
  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };

  it("help and description both draw a hint under the control", async () => {
    const el = await mount({
      fields: [
        { name: "host", label: "Host", type: "text", help: "The machine to reach" },
        { name: "port", label: "Port", type: "number", description: "Defaults to 22" },
        { name: "bare", label: "Bare", type: "text" },
      ],
    });
    const hints = [...el.querySelectorAll(".form-hint")].map((h) => h.textContent.trim());
    assert.deepEqual(hints, ["The machine to reach", "Defaults to 22"]);
  });

  it("a field's class lands on its wrapper, for a layout the form has no opinion about", async () => {
    const el = await mount({ fields: [{ name: "body", label: "Body", type: "textarea", class: "span-2" }] });
    assert.ok(el.querySelector(".form-field.span-2"));
  });

  it("disabled and readonly reach the control", async () => {
    const el = await mount({
      fields: [
        { name: "locked", label: "Locked", type: "text", disabled: true },
        { name: "fixed", label: "Fixed", type: "text", readonly: true },
      ],
    });
    assert.equal(el.querySelector('[name="locked"]').disabled, true);
    assert.equal(el.querySelector('[name="fixed"]').readonly, true);
  });

  it("min, max and step reach a number input", async () => {
    const el = await mount({ fields: [{ name: "port", label: "Port", type: "number", min: 1, max: 65535, step: 1 }] });
    const inner = await until(() => el.querySelector("input[type=number]"), "the native number input");
    assert.equal(inner.getAttribute("min"), "1");
    assert.equal(inner.getAttribute("max"), "65535");
    assert.equal(inner.getAttribute("step"), "1");
  });

  describe("visibleIf", () => {
    const fields = [
      { name: "tls", label: "TLS", type: "checkbox" },
      { name: "cert", label: "Certificate", type: "text", visibleIf: "tls" },
      { name: "advanced", label: "Advanced", type: "text", visibleIf: (v) => v.tls && v.cert === "self" },
    ];

    it("a field named by another is drawn only while that one is truthy", async () => {
      const off = await mount({ fields, data: {} });
      assert.equal(off.querySelector('[name="cert"]'), null);
      const on = await mount({ fields, data: { tls: true } });
      assert.ok(on.querySelector('[name="cert"]'));
    });

    it("a predicate sees every current value", async () => {
      const el = await mount({ fields, data: { tls: true, cert: "self" } });
      assert.ok(el.querySelector('[name="advanced"]'));
      const nope = await mount({ fields, data: { tls: true, cert: "letsencrypt" } });
      assert.equal(nope.querySelector('[name="advanced"]'), null);
    });

    it("a hidden field is not collected, so a branch nobody saw never reaches the payload", async () => {
      const el = await mount({ fields, data: { tls: false, cert: "left over" } });
      const collected = el.collectFormData();
      assert.equal("cert" in collected, false);
      assert.equal(collected.tls, false);
    });
  });

  describe("field-change", () => {
    it("a widget's own onChange announces the edit, whatever event it listened to", async () => {
      registerFormFieldRenderer("stat", (field, value, onChange, html) =>
        html`<button type="button" @click=${() => onChange("live")}>${String(value ?? "")}</button>`);
      const el = await mount({
        fields: [
          { name: "status", label: "Status", type: "text", cmsType: "stat" },
          { name: "when", label: "When", type: "fancy-date" },
        ],
        typeHandlers: {
          "fancy-date": {
            render: (field, value, onChange) => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "fancy";
              button.addEventListener("click", () => onChange("2026-09-10"));
              return button;
            },
          },
        },
        data: {},
      });
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push([e.detail.name, e.detail.value]));

      el.querySelector("[cmstype], .form-field button:not(.fancy)")?.click();
      await frame();
      el.querySelector("button.fancy").click();
      await frame();

      assert.deepEqual(seen, [["status", "live"], ["when", "2026-09-10"]]);
      assert.deepEqual(el.collectFormData(), { status: "live", when: "2026-09-10" });
    });

    it("announces each edit with the field, its value and the whole set", async () => {
      const el = await mount({
        fields: [{ name: "host", label: "Host", type: "text" }, { name: "port", label: "Port", type: "number" }],
        data: { host: "", port: null },
      });
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push(e.detail));

      const host = await until(() => el.querySelector('[name="host"] input'), "the host input");
      host.value = "vps.example";
      host.dispatchEvent(new Event("input", { bubbles: true }));
      await frame();

      assert.equal(seen.length, 1);
      assert.equal(seen[0].name, "host");
      assert.equal(seen[0].value, "vps.example");
      assert.equal(seen[0].values.host, "vps.example");
      assert.equal(el.data.host, "vps.example", "and the form keeps it, so a re-render does not lose it");
    });

    it("an edit that changes nothing announces nothing", async () => {
      const el = await mount({ fields: [{ name: "host", label: "Host", type: "text" }], data: { host: "same" } });
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push(e.detail));
      const host = await until(() => el.querySelector('[name="host"] input'), "the host input");
      host.dispatchEvent(new Event("input", { bubbles: true }));
      await frame();
      assert.deepEqual(seen, []);
    });

    it("a visibleIf depending on the edited field re-evaluates without a caller doing anything", async () => {
      const el = await mount({
        fields: [
          { name: "tls", label: "TLS", type: "checkbox" },
          { name: "cert", label: "Certificate", type: "text", visibleIf: "tls" },
        ],
        data: { tls: false },
      });
      assert.equal(el.querySelector('[name="cert"]'), null);
      const box = await until(() => el.querySelector('[name="tls"] input'), "the tls checkbox");
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      await frame();
      await tick();
      assert.ok(el.querySelector('[name="cert"]'), "the dependent field appeared");
    });
  });
});

describe("lc-form: refusing a submit", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];
  after(() => {
    for (const el of mounted) el.remove();
  });
  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };

  it("an empty required field draws its reason instead of failing silently", async () => {
    const el = await mount({
      fields: [{ name: "title", label: "Title", type: "text", required: true }],
      data: {},
    });
    /** @type {any[]} */
    const submitted = [];
    /** @type {any[]} */
    const refused = [];
    el.addEventListener("form-submit", (e) => submitted.push(e.detail));
    el.addEventListener("form-invalid", (e) => refused.push(e.detail));

    assert.equal(el.submit(), false, "submit says it did not go");
    await frame();
    assert.deepEqual(submitted, []);
    assert.deepEqual(refused, [{ errors: { title: "Title is required" } }]);
    assert.equal(el.querySelector(".form-error").textContent.trim(), "Title is required");
  });

  it("a widget-rendered required field is checked, which the platform cannot do", async () => {
    registerFormFieldRenderer("swatch2", (field, value, onChange, html) =>
      html`<button type="button" @click=${() => onChange("#fff")}>pick</button>`);
    const el = await mount({
      fields: [{ name: "colour", label: "Colour", type: "text", required: true, cmsType: "swatch2" }],
      data: {},
    });
    assert.equal(el.querySelector("input"), null, "no native control carries the requiredness");
    assert.equal(el.submit(), false);
    await frame();
    assert.equal(el.querySelector(".form-error").textContent.trim(), "Colour is required");

    el.querySelector("button").click();
    await frame();
    assert.equal(el.submit(), true, "once it has a value it goes");
  });

  it("an empty required multi-select is empty, not a value", async () => {
    const el = await mount({
      fields: [{ name: "themes", label: "Themes", type: "multi-select", required: true, options: [{ value: "a", label: "A" }] }],
      data: { themes: [] },
    });
    assert.deepEqual(el.validate(), { themes: "Themes is required" });
  });

  it("a hidden required field cannot hold the form back", async () => {
    const el = await mount({
      fields: [
        { name: "tls", label: "TLS", type: "checkbox" },
        { name: "cert", label: "Certificate", type: "text", required: true, visibleIf: "tls" },
      ],
      data: { tls: false },
    });
    assert.deepEqual(el.validate(), {});
    assert.equal(el.submit(), true);
  });

  it("a filled form goes, and validate answers nothing", async () => {
    const el = await mount({
      fields: [{ name: "title", label: "Title", type: "text", required: true }],
      data: { title: "A place" },
    });
    /** @type {any[]} */
    const submitted = [];
    el.addEventListener("form-submit", (e) => submitted.push(e.detail));
    assert.deepEqual(el.validate(), {});
    assert.equal(el.submit(), true);
    await frame();
    assert.deepEqual(submitted, [{ title: "A place" }]);
  });
});

describe("lc-form: files", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];
  after(() => {
    for (const el of mounted) el.remove();
  });
  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };
  const aFile = (name, type = "image/png") => new File(["x"], name, { type });

  it("a file field renders an upload, and a files field takes many", async () => {
    const el = await mount({
      fields: [
        { name: "cover", label: "Cover", type: "file", accept: "image/*" },
        { name: "gallery", label: "Gallery", type: "files" },
      ],
      data: {},
    });
    const cover = el.querySelector('[name="cover"]');
    assert.equal(cover.tagName.toLowerCase(), "lc-file-upload");
    assert.equal(cover.getAttribute("accept"), "image/*");
    assert.equal(cover.multiple, false);
    assert.equal(el.querySelector('[name="gallery"]').multiple, true);
  });

  it("a stored url and a newly picked File live in the same list", async () => {
    const el = await mount({
      fields: [{ name: "gallery", label: "Gallery", type: "files" }],
      data: { gallery: ["https://cdn.example/a.png"] },
    });
    const upload = /** @type {any} */ (el.querySelector('[name="gallery"]'));
    assert.deepEqual(upload.entries, ["https://cdn.example/a.png"]);

    upload._processFiles([aFile("b.png")]);
    await frame();
    assert.equal(upload.entries.length, 2);
    assert.equal(upload.entries[0], "https://cdn.example/a.png");
    assert.ok(upload.entries[1] instanceof File);
  });

  it("the payload carries the Blobs untouched, which is what the store uploads", async () => {
    const el = await mount({ fields: [{ name: "cover", label: "Cover", type: "file" }], data: {} });
    const upload = /** @type {any} */ (el.querySelector('[name="cover"]'));
    const picked = aFile("cover.png");
    upload._processFiles([picked]);
    await frame();

    const collected = el.collectFormData();
    assert.equal(collected.cover, picked, "the File itself, not a name or a url");
    assert.equal(el.serialize(collected).cover, picked, "and serialize leaves it alone");
  });

  it("an empty file field is null and an empty files field is a list", async () => {
    const el = await mount({
      fields: [
        { name: "cover", label: "Cover", type: "file" },
        { name: "gallery", label: "Gallery", type: "files" },
      ],
      data: {},
    });
    assert.deepEqual(el.collectFormData(), { cover: null, gallery: [] });
  });

  it("one preview url per File, made once and revoked when the File goes", async () => {
    const el = await mount({ fields: [{ name: "gallery", label: "Gallery", type: "files" }], data: {} });
    const upload = /** @type {any} */ (el.querySelector('[name="gallery"]'));
    const picked = aFile("a.png");
    upload._processFiles([picked]);
    await frame();
    await frame();

    const first = upload._previewUrl(picked);
    assert.equal(upload._previewUrl(picked), first, "the same File always answers the same url");
    assert.equal(upload._objectUrls.size, 1);

    upload.removeFile(0);
    await frame();
    assert.equal(upload._objectUrls.size, 0, "and the url is revoked with the File");
  });

  it("a stored url previews itself, with no object url made for it", async () => {
    const el = await mount({
      fields: [{ name: "cover", label: "Cover", type: "file" }],
      data: { cover: "https://cdn.example/a.png" },
    });
    const upload = /** @type {any} */ (el.querySelector('[name="cover"]'));
    await frame();
    assert.equal(upload._objectUrls.size, 0);
    const img = upload.querySelector("img.file-preview");
    assert.equal(img?.getAttribute("src"), "https://cdn.example/a.png");
  });
});

describe("lc-form: nested fields", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];
  after(() => {
    for (const el of mounted) el.remove();
  });
  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };

  const LINKS = {
    name: "links",
    label: "Links",
    type: "array",
    addLabel: "Add a link",
    emptyLabel: "No links yet.",
    itemFields: [
      { name: "url", label: "URL", type: "url" },
      { name: "title", label: "Title", type: "text" },
    ],
  };

  describe("object", () => {
    const META = {
      name: "meta",
      label: "Meta",
      type: "object",
      fields: [
        { name: "title", label: "Title", type: "text" },
        { name: "count", label: "Count", type: "number" },
      ],
    };

    it("its fields are addressed under its own name", async () => {
      const el = await mount({ fields: [META], data: { meta: { title: "A page", count: 3 } } });
      assert.deepEqual(controlNames(el), ["meta.title", "meta.count"]);
    });

    it("editing one child leaves the others where they were", async () => {
      const el = await mount({ fields: [META], data: { meta: { title: "A page", count: 3 } } });
      const title = await until(() => el.querySelector('[name="meta.title"] input'), "the title input");
      title.value = "Renamed";
      title.dispatchEvent(new Event("input", { bubbles: true }));
      await frame();
      assert.deepEqual(el.collectFormData(), { meta: { title: "Renamed", count: 3 } });
    });
  });

  describe("array", () => {
    it("draws one group per entry, each control at its own index", async () => {
      const el = await mount({
        fields: [LINKS],
        data: { links: [{ url: "https://a", title: "A" }, { url: "https://b", title: "B" }] },
      });
      assert.deepEqual(controlNames(el), ["links[0].url", "links[0].title", "links[1].url", "links[1].title"]);
    });

    it("an empty list says so, and adding gives one blank entry", async () => {
      const el = await mount({ fields: [LINKS], data: { links: [] } });
      assert.equal(el.querySelector(".lc-form-list-empty").textContent.trim(), "No links yet.");
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push(e.detail.value));
      const add = [...el.querySelectorAll("lc-button")].at(-1);
      press(add);
      await frame();
      assert.deepEqual(seen.at(-1), [{ url: null, title: null }]);
    });

    it("removing an entry closes the gap rather than leaving a hole", async () => {
      const el = await mount({
        fields: [LINKS],
        data: { links: [{ url: "https://a" }, { url: "https://b" }, { url: "https://c" }] },
      });
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push(e.detail.value));
      const remove = el.querySelectorAll(".lc-form-list-item")[1].querySelectorAll("lc-button")[2];
      press(remove);
      await frame();
      assert.deepEqual(seen.at(-1).map((l) => l.url), ["https://a", "https://c"]);
    });

    it("moving an entry swaps it with its neighbour, and the ends cannot move past them", async () => {
      const el = await mount({
        fields: [LINKS],
        data: { links: [{ url: "https://a" }, { url: "https://b" }] },
      });
      /** @type {any[]} */
      const seen = [];
      el.addEventListener("field-change", (e) => seen.push(e.detail.value));
      const first = el.querySelectorAll(".lc-form-list-item")[0].querySelectorAll("lc-button");
      assert.equal(first[0].disabled, true, "the first entry cannot move up");
      press(first[1]);
      await frame();
      assert.deepEqual(seen.at(-1).map((l) => l.url), ["https://b", "https://a"]);
    });

    it("a full list stops offering to add another", async () => {
      const el = await mount({ fields: [{ ...LINKS, max: 1 }], data: { links: [{ url: "https://a" }] } });
      const add = [...el.querySelectorAll("lc-button")].at(-1);
      assert.equal(add.disabled, true);
    });

    it("editing inside an entry keeps the list a list", async () => {
      const el = await mount({
        fields: [LINKS],
        data: { links: [{ url: "https://a", title: "A" }, { url: "https://b", title: "B" }] },
      });
      const title = await until(() => el.querySelector('[name="links[1].title"] input'), "the second title");
      title.value = "Bee";
      title.dispatchEvent(new Event("input", { bubbles: true }));
      await frame();
      assert.deepEqual(el.collectFormData().links, [
        { url: "https://a", title: "A" },
        { url: "https://b", title: "Bee" },
      ]);
    });
  });

  describe("json", () => {
    it("shows a value as indented text and reads text back as a value", async () => {
      const el = await mount({ fields: [{ name: "config", label: "Config", type: "json" }], data: { config: { a: 1 } } });
      const area = await until(() => el.querySelector('[name="config"] textarea'), "the json textarea");
      assert.equal(area.value, '{\n  "a": 1\n}');
      assert.deepEqual(el.serialize({ config: '{"b":2}' }), { config: { b: 2 } });
    });

    it("half-written json stays text rather than becoming nothing", async () => {
      const el = await mount({ fields: [{ name: "config", label: "Config", type: "json" }], data: {} });
      assert.deepEqual(el.serialize({ config: '{"b":' }), { config: '{"b":' });
    });
  });
});

describe("lc-form: options that have to be fetched", () => {
  /** @type {HTMLElement[]} */
  const mounted = [];
  after(() => {
    for (const el of mounted) el.remove();
  });
  const mount = async (props) => {
    const el = /** @type {any} */ (document.createElement("lc-form"));
    Object.assign(el, props);
    document.body.appendChild(el);
    mounted.push(el);
    await frame();
    await tick();
    return el;
  };

  const deferred = () => {
    /** @type {(value: unknown) => void} */
    let resolve = () => {};
    /** @type {(error: Error) => void} */
    let reject = () => {};
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  it("a field asks for its options once the form is on screen", async () => {
    /** @type {Record<string, unknown>[]} */
    const asked = [];
    const el = await mount({
      fields: [{
        name: "repo", label: "Repo", type: "select",
        loadOptions: async (values) => (asked.push(values), [{ value: "a", label: "A" }]),
      }],
      data: { account: "octo" },
    });
    await tick();
    assert.deepEqual(asked, [{ account: "octo" }], "and is handed the values as they stand");
    assert.deepEqual(el._options.repo.options, [{ value: "a", label: "A" }]);
  });

  it("while they are coming the control is held, and a failure says why", async () => {
    const first = deferred();
    const el = await mount({
      fields: [{ name: "repo", label: "Repo", type: "select", loadOptions: () => first.promise }],
      data: {},
    });
    await tick();
    assert.equal(el._options.repo.loading, true);
    assert.equal(await until(() => el.querySelector('[name="repo"]')?.disabled, "the held control"), true);

    first.reject(new Error("no network"));
    await tick();
    await frame();
    assert.equal(el._options.repo.loading, false);
    assert.equal(el._options.repo.error, "no network");
    assert.equal(el.querySelector(".form-hint")?.textContent.trim(), "no network");
  });

  it("changing what they depend on clears the field and asks again", async () => {
    /** @type {Record<string, unknown>[]} */
    const asked = [];
    const el = await mount({
      fields: [
        { name: "account", label: "Account", type: "text" },
        {
          name: "repo", label: "Repo", type: "select", dependsOn: "account",
          loadOptions: async (values) => (asked.push({ ...values }), [{ value: `${values.account}/one`, label: "one" }]),
        },
      ],
      data: { account: "octo", repo: "octo/one" },
    });
    await tick();
    assert.equal(asked.length, 1);

    const account = await until(() => el.querySelector('[name="account"] input'), "the account input");
    account.value = "other";
    account.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    assert.equal(el.data.repo, "", "a list loaded for one account says nothing about another");
    assert.equal(asked.length, 2);
    assert.equal(asked[1].account, "other");
  });

  it("a slower earlier load never overwrites a later one", async () => {
    const slow = deferred();
    const fast = deferred();
    const answers = [slow.promise, fast.promise];
    const el = await mount({
      fields: [
        { name: "account", label: "Account", type: "text" },
        { name: "repo", label: "Repo", type: "select", dependsOn: "account", loadOptions: () => answers.shift() },
      ],
      data: { account: "one" },
    });
    await tick();

    const account = await until(() => el.querySelector('[name="account"] input'), "the account input");
    account.value = "two";
    account.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    fast.resolve([{ value: "two/repo", label: "the second answer" }]);
    await tick();
    slow.resolve([{ value: "one/repo", label: "the first answer, arriving last" }]);
    await tick();

    assert.deepEqual(el._options.repo.options, [{ value: "two/repo", label: "the second answer" }]);
  });

  it("a saved value stays selected while its options are still coming", async () => {
    const pending = deferred();
    const el = await mount({
      fields: [{ name: "repo", label: "Repo", type: "select", loadOptions: () => pending.promise }],
      data: { repo: "octo/saved" },
    });
    const select = await until(() => el.querySelector('[name="repo"]'), "the repo select");
    await tick();
    assert.deepEqual(select.options, [{ value: "octo/saved", label: "octo/saved" }]);
    assert.equal(select.value, "octo/saved");

    pending.resolve([{ value: "octo/saved", label: "Saved" }, { value: "octo/other", label: "Other" }]);
    await tick();
    await frame();
    assert.deepEqual(el.querySelector('[name="repo"]').options, [
      { value: "octo/saved", label: "Saved" },
      { value: "octo/other", label: "Other" },
    ], "and the loaded label replaces the placeholder once it lands");
  });
});
