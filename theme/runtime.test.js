import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./classes/index.js";
import { createRuntime } from "./runtime.js";

const fakeElement = (classes, children = []) => ({
  nodeType: 1,
  classList: classes.split(/\s+/).filter(Boolean),
  querySelectorAll: () => children,
});

const fakeDoc = (rootChildren) => {
  const styles = [];
  const doc = {
    documentElement: fakeElement("", rootChildren),
    head: { appendChild: (el) => styles.push(el) },
    querySelector: () => styles[0] ?? null,
    createElement: () => {
      const el = { textContent: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      return el;
    },
  };
  return { doc, styles };
};

describe("runtime", () => {
  it("boot scan compiles every class once and flushes one style tag", () => {
    const { doc, styles } = fakeDoc([
      fakeElement("flex items-center"),
      fakeElement("flex text-muted"),
    ]);
    const frames = [];
    const runtime = createRuntime(createEngine(), { doc, raf: (cb) => frames.push(cb) });
    runtime.start();
    assert.equal(frames.length, 1);
    frames[0]();
    assert.equal(styles.length, 1);
    assert.ok(styles[0].textContent.includes(".flex{display:flex}"));
    assert.ok(styles[0].textContent.includes(".text-muted{color:var(--text-muted)}"));
    assert.equal(styles[0].textContent.match(/\.flex\{/g).length, 1);
  });

  it("prepends the preflight border reset", () => {
    const { doc, styles } = fakeDoc([fakeElement("border")]);
    const frames = [];
    const runtime = createRuntime(createEngine(), { doc, raf: (cb) => frames.push(cb) });
    runtime.start();
    frames[0]();
    assert.ok(styles[0].textContent.startsWith("*,::before,::after{box-sizing:border-box;border-width:0"));
  });

  it("batches many additions into a single frame", () => {
    const { doc } = fakeDoc([]);
    const frames = [];
    const runtime = createRuntime(createEngine(), { doc, raf: (cb) => frames.push(cb) });
    runtime.start();
    frames.shift()();
    runtime.addClasses(["p-4", "m-2", "gap-3", "text-sm"]);
    assert.equal(frames.length, 1);
  });

  it("a class seen twice is never recompiled", () => {
    const engine = createEngine();
    const compile = mock.method(engine, "compile");
    const { doc } = fakeDoc([]);
    const runtime = createRuntime(engine, { doc, raf: () => {} });
    runtime.start();
    runtime.addClasses(["p-4", "p-4", "p-4"]);
    assert.equal(compile.mock.calls.filter((c) => c.arguments[0] === "p-4").length, 1);
  });

  it("warns once for utility-shaped unknowns, stays silent on semantic names", () => {
    const warn = mock.method(console, "warn", () => {});
    const { doc } = fakeDoc([]);
    const runtime = createRuntime(createEngine(), { doc, raf: () => {} });
    runtime.start();
    runtime.addClasses(["sheet-banner", "hover:not-a-thing", "hover:not-a-thing"]);
    const messages = warn.mock.calls.map((c) => c.arguments.join(" "));
    warn.mock.restore();
    assert.deepEqual(messages, ["[tw] unknown class: hover:not-a-thing"]);
  });

  it("output rule order matches a build-time generate of the same classes", () => {
    const classes = ["px-2", "sm:flex", "p-4", "hover:underline"];
    const engine = createEngine();
    const { doc, styles } = fakeDoc([fakeElement(classes.join(" "))]);
    const frames = [];
    const runtime = createRuntime(engine, { doc, raf: (cb) => frames.push(cb), preflight: false });
    runtime.start();
    frames[0]();
    assert.equal(styles[0].textContent, createEngine().generate(classes).css);
  });
});
