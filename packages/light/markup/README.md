# @lightstart/light/markup

The renderer on an in-memory tree: no document, no browser. Two uses: a server renders a page with it and serializes the tree into markup the browser host adopts without replacing a node; and the engine's conformance suite (`html/conformance.test.js`) runs against it under plain `node --test`, which makes it the host every other host is measured against.

| File | What it owns |
|---|---|
| `node.js` | The tree: `MElement` (attributes, properties and listeners as maps, plus the DOM members a view reads: attributes, class list, child and sibling links, listeners, query selectors, text content, connectivity), `MText`, `MComment`, `MFragment` (its children splice into the parent on insert), `MRoot` (what counts as connected), and the node operations |
| `registry.js` | The custom element registry a process without `globalThis.customElements` uses: `define`, `get` and `whenDefined`, which `View.define`/`View.register` fill and `MarkupHost` reads to build a registered element as an instance of its class |
| `host.js` | `MarkupHost`: templates through the parser and `html/tokenizer.js`, clones into markup nodes, registered view tags as instances of their class, listeners held on the element with `dispatch` to fire them, frames as timeouts, errors to `onError` when set; `settle()` waits for the view queue to go quiet |
| `serialize.js` | `serialize` (markup with the engine's marker comments, for a page to adopt), `markupOf` (without them, for a reader), `textContent` |
| `render.js` | `renderToString(template, { markers })` and `renderToStringAsync(template, { markers, onError })`: the template rendered on a markup host and serialized, the host in use before put back. The async form waits until every view it contains has run its queued update |


A server renders a page with `renderToString` and the browser adopts it with the same template, keeping every served node:

```js
// server
import { html } from "@lightstart/light/html";
import { renderToString } from "@lightstart/light/markup";
const page = (rows) => html`<ul>${rows.map((row) => html`<li>${row.title}</li>`)}</ul>`;
const body = `<main id="page">${renderToString(page(rows))}</main>`;

// browser, on a page that sets window.__PRERENDERED__ = true
import { render } from "@lightstart/light/html";
render(page(rows), document.getElementById("page"), { adopt: "bind" });
```

```js
import { configure, html, render } from "@lightstart/light/html/core.js";
import { effect } from "@lightstart/light/signals";
import { MRoot, MarkupHost, serialize } from "@lightstart/light/markup/index.js";

configure({ host: new MarkupHost(), effect });
const root = new MRoot();
render(html`<p class=${"note"}>${"hello"}</p>`, root);
serialize(root); // <!--$r--><p class="note"><!--$-->hello<!--/--></p><!--/r-->
```

The tokenizer reads markup the way a browser does for everything a template is likely to carry: lowercased HTML names, void elements, raw text in `<script>`, `<style>`, `<textarea>` and `<title>`, character references. It does not reproduce the HTML parser's implied end tags or table fixups; elements nest as written.

## Views on the markup host

A template's view tag does not stay an empty element. In a process without `HTMLElement`, `View` extends `MElement`, and `View.define`/`View.register` install their class in `registry.js` instead of the browser's `customElements`. `MarkupHost` sees a registered tag while cloning and makes the element an instance of that class; inserting it under an `MRoot` runs its `connectedCallback`, and removing it runs `disconnectedCallback`. Its `$commit` then renders into the same `MElement`, so the engine's markers and bindings come out exactly as they do in the browser.

Views render on this tree off the browser: importing `@lightstart/light/markup` (its `install.js`) names the markup element class and a registry to light's views, so `View.define` registers a view and the markup host builds it as one. Import it before the views, since a view module's class is made when it loads; the browser bundle carries none of this.

`renderToStringAsync` renders, then waits for the view queue: each scheduled flush is a timeout, and a view's render may schedule another, so it waits until two frames pass with nothing scheduled. A hook that throws (a DOM API this tree does not have) goes to `onError` and the render finishes.

```js
import { html } from "@lightstart/light/html/core.js";
import View, { defineComponent } from "@lightstart/light";
import { renderToStringAsync } from "@lightstart/light/markup";

View.define(defineComponent({ tag: "x-card", props: { title: "" }, render() { return html`<h2>${this.title}</h2>`; } }));
const body = await renderToStringAsync(html`<x-card title="A"></x-card>`);
```

`children` lists element children, as in the DOM; `childNodes` holds text and comments too.

