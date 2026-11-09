/**
 * The home page's words and code: the facts strip, the two principles, the
 * eight pairs of a snippet and what it does, and the footer's links. Pure
 * data; the page draws it and `home-demos.js` runs the live side. The package
 * name is interpolated into the snippets so the dev server's specifier
 * rewrite, which reads the module's text, leaves them alone.
 */

const LIGHT = "@lightstart/light";

/** @import { FormField } from "@lightstart/light/components/types.ts" */

export const TAGLINE = "Web Components made simple.";

export const FACTS = [
  { value: "0", label: "dependencies", line: "Nothing under node_modules besides Light itself. What you install is what runs." },
  { value: "No", label: "build step", line: "ES modules served as they are. An importmap, or a bundler if you already have one." },
  { value: "JS", label: "with types", line: "Written in JavaScript with JSDoc. The .d.ts files ship in the package, so TypeScript reads every signature." },
];

export const PRINCIPLES = [
  {
    eyebrow: "The name",
    title: "Light, as in light DOM.",
    text: "Web components come with the shadow DOM, and it makes them far more complicated than they need to be. Light turns it off. A component is a plain element in the page, with the page's CSS and the page's events, and that alone makes it a smaller and faster replacement for React.",
  },
  {
    eyebrow: "The language",
    title: "JavaScript, typed.",
    text: "Light is plain JavaScript, so it runs as written, with no build step. Its types come from JSDoc, checked by TypeScript and shipped as .d.ts, so in a TypeScript project it is a typed package like any other.",
  },
];

/** @type {Array<{ key: string, icon: string, title: string, card: string, lede: string, language: string }>} */
export const PAIRS = [
  { key: "counter", icon: "box", title: "View engine", card: "View.define with the props beside the tag, mixins, lifecycle hooks, $own for cleanup, plugins. One render per element per frame.", lede: "A component is an object: its properties, its template, its hooks. Light makes it a custom element.", language: "js" },
  { key: "templates", icon: "code", title: "html", card: "Tagged templates with keyed lists, element bindings and slots in the light DOM. Prerendered markup is adopted, not replaced.", lede: "Templates are tagged template literals. Lists stay keyed, children slot in, served markup is reused.", language: "js" },
  { key: "signals", icon: "activity", title: "Signals", card: "signal, computed, effect and batch. A component's state is a store of them.", lede: "State is signals. A computed follows what it reads; an effect runs when that changes.", language: "js" },
  { key: "attributes", icon: "braces", title: "Properties", card: "A property is its default: a number, a string, a boolean, an array, an object. It reads and reflects its attribute; T.* adds an option.", lede: "A property is its default, and reads its attribute. T.* is there when it needs an option.", language: "js" },
  { key: "env", icon: "compass", title: "env and navigation", card: "Viewport, breakpoint, OS and colour scheme. Links are plain anchors until a router is configured.", lede: "The page's size, OS and colour scheme, and links that work with or without a router.", language: "js" },
  { key: "theme", icon: "palette", title: "Theme", card: "Tokens from a theme object, five presets, skins scoped to one element, dark mode, icons from any Iconify set.", lede: "A theme is an object. Apply it to the page, or to one element as a skin.", language: "js" },
  { key: "form", icon: "layout-grid", title: "Components", card: "Forms, tables, charts, overlays, navigation, app shells and page sections. Each one has a demo.", lede: "Forms, tables, charts, overlays, navigation, app shells and page sections. Each one has a demo.", language: "html" },
  { key: "test", icon: "flask-conical", title: "light test", card: "node:test and node:assert in the browser. The same test file runs under node or in Chromium.", lede: "Tests are node:test files. light test runs them in a real browser.", language: "js" },
];

/** @type {Record<string, string>} */
export const SNIPPETS = {
  counter: `import View from "${LIGHT}";
import { html } from "${LIGHT}/html";

View.define("my-counter", { count: 0, label: "Clicks" }, (el) => html\`
  <button @click=\${() => el.count++}>\${el.label}: \${el.count}</button>
\`);`,
  templates: `render() {
  return html\`
    <ul>\${this.items.map((item) => key(item.id, html\`<li>\${item.text}</li>\`))}</ul>
    \${this.items.length ? nothing : html\`<p>Nothing yet</p>\`}
    <slot name="footer"></slot>
  \`;
}`,
  signals: `import { signal, computed, effect } from "${LIGHT}/signals";

const qty = signal(2);
const price = signal(9.5);
const total = computed(() => qty() * price());

effect(() => { output.textContent = total().toFixed(2); });
qty.set(3); // output reads 28.50`,
  attributes: `View.define("my-counter", { label: "Clicks", count: 0, big: false }, (el) => html\`...\`);

// in the page
<my-counter></my-counter>
<my-counter label="Taps" count="7" big></my-counter>`,
  env: `import { env } from "${LIGHT}/env";
import { configureNavigation } from "${LIGHT}/navigation";

env.subscribe(() => { label.textContent = \`\${env.width}×\${env.height} · \${env.breakpoint} · \${env.os}\`; });

configureNavigation({ href: (path) => \`/app\${path}\`, go: router.go });
html\`<lc-link href="/components">Components</lc-link>\``,
  theme: `import { applyTheme, applyScopedTheme } from "${LIGHT}/theme";
import { loadPreset } from "${LIGHT}/theme/presets.js";

applyTheme({
  color: { primary: "#101210", accent: "#e4572e" },
  radius: { field: "0.125rem", box: "0.25rem" },
});

applyScopedTheme("[data-skin=neo]", await loadPreset("neobrutalist"));`,
  form: `<lc-form
  .fields=\${[
    { name: "email", label: "Email", type: "email", required: true },
    { name: "plan", label: "Plan", type: "select", options: ["Free", "Pro"] },
    { name: "news", label: "Newsletter", type: "checkbox" },
  ]}
  @form-submit=\${(e) => save(e.detail)}
>
  <lc-button primary type="submit">Save</lc-button>
</lc-form>`,
  test: `import assert from "node:assert/strict";
import { it } from "node:test";

it("counts a click", async () => {
  const el = document.createElement("my-counter");
  document.body.append(el);
  el.querySelector("button").click();
  await el.$requestUpdate();
  assert.equal(el.count, 1);
});`,
};

/** @type {FormField[]} */
export const FORM_FIELDS = [
  { name: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
  { name: "plan", label: "Plan", type: "select", options: ["Free", "Pro"], defaultValue: "Free" },
  { name: "news", label: "Newsletter", type: "checkbox", checkboxLabel: "Newsletter" },
];

export const THEME_SKIN = "neobrutalist";

export const PRICE = 9.5;

export const LIST_ITEMS = ["Milk", "Bread", "Coffee"];

export const TERMINAL = [
  { prompt: "$", text: "light test counter.browser.test.js" },
  { mark: "✓", text: "1 passed", muted: "0 failed", file: "counter.browser.test.js" },
  { text: "1 passed, 1 total", bold: true },
];
