# @bootstrapp/light/markup

The renderer on an in-memory tree: no document, no browser. Two uses: a server renders a page with it and serializes the tree into markup the browser host adopts without replacing a node; and the engine's conformance suite (`html/conformance.test.js`) runs against it under plain `node --test`, which makes it the host every other host is measured against.

| File | What it owns |
|---|---|
| `node.js` | The tree: `MElement` (attributes, properties and listeners as maps), `MText`, `MComment`, `MFragment` (its children splice into the parent on insert), `MRoot` (what counts as connected), and the node operations |
| `host.js` | `MarkupHost`: templates through the parser and `html/tokenizer.js`, clones into markup nodes, listeners held on the element with `dispatch` to fire them, frames as timeouts, errors to `onError` when set |
| `serialize.js` | `serialize` (markup with the engine's marker comments, for a page to adopt), `markupOf` (without them, for a reader), `textContent` |

```js
import { configure, html, render } from "@bootstrapp/light/html/core.js";
import { effect } from "@bootstrapp/light/signals";
import { MRoot, MarkupHost, serialize } from "@bootstrapp/light/markup/index.js";

configure({ host: new MarkupHost(), effect });
const root = new MRoot();
render(html`<p class=${"note"}>${"hello"}</p>`, root);
serialize(root); // <!--$r--><p class="note"><!--$-->hello<!--/--></p><!--/r-->
```

The tokenizer reads markup the way a browser does for everything a template is likely to carry: lowercased HTML names, void elements, raw text in `<script>`, `<style>`, `<textarea>` and `<title>`, character references. It does not reproduce the HTML parser's implied end tags or table fixups; elements nest as written.
