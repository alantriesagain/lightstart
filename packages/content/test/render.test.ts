// node-only
/**
 * @file `renderContent` as markup through light's markup host: headings with unique ids, a
 * paragraph, a task list, code, a safe and a refused link, a table, a hook's component, and raw
 * HTML escaped unless the app opts in.
 */

import "@lightstart/light/markup";
import { html, nothing } from "@lightstart/light/html";
import { renderToString } from "@lightstart/light/markup";
import { done, ok } from "@lightstart/test/assert.ts";
import { renderContent } from "../render.ts";
import type { ContentBlock } from "../json.ts";

const blocks: ContentBlock[] = [
  { type: "heading", level: 2, text: "Hello world", children: [{ type: "text", text: "Hello world" }] },
  { type: "heading", level: 2, text: "Hello world", children: [{ type: "text", text: "Hello world" }] },
  { type: "paragraph", children: [{ type: "text", text: "Some " }, { type: "strong", children: [{ type: "text", text: "words" }] }] },
  {
    type: "list",
    ordered: false,
    start: 1,
    loose: false,
    items: [
      { task: true, checked: true, blocks: [{ type: "paragraph", children: [{ type: "text", text: "done" }] }] },
      { task: true, checked: false, blocks: [{ type: "paragraph", children: [{ type: "text", text: "todo" }] }] },
    ],
  },
  { type: "code", info: "js", text: "const answer = 42;" },
  { type: "paragraph", children: [{ type: "link", href: "https://example.com", title: "", children: [{ type: "text", text: "ok" }] }] },
  { type: "paragraph", children: [{ type: "link", href: "javascript:alert(1)", title: "", children: [{ type: "text", text: "bad" }] }] },
  {
    type: "table",
    header: [[{ type: "text", text: "Left" }], [{ type: "text", text: "Center" }]],
    aligns: ["left", "center"],
    rows: [[[{ type: "strong", children: [{ type: "text", text: "bold" }] }], [{ type: "text", text: "cell" }]]],
  },
  { type: "html", text: "<div>raw</div>" },
];

const out = renderToString(renderContent(blocks), { markers: false });
ok("a heading gets a slug id", out.includes('<h2 id="hello-world">'));
ok("a repeated heading gets a numbered id", out.includes('<h2 id="hello-world-2">'));
ok("a paragraph keeps its inline marks", out.includes("<p>Some <strong>words</strong></p>"));
ok("a task item draws a checkbox", out.includes('<input type="checkbox" disabled="" checked="">'));
ok("a code block names its language", out.includes('<pre><code class="language-js">const answer = 42;</code></pre>'));
ok("a safe link keeps its address", out.includes('<a href="https://example.com">ok</a>'));
ok("a refused link writes no href", !out.includes("javascript:") && out.includes("bad"));
ok("a table draws its cells with alignment", out.includes('<th align="center">Center</th>') && out.includes('<td align="left"><strong>bold</strong></td>'));
ok("raw HTML is escaped by default", out.includes("&lt;div&gt;raw&lt;/div&gt;") && !out.includes("<div>raw</div>"));

const opted = renderToString(renderContent([{ type: "html", text: "<div>raw</div>" }], { html: true }), { markers: false });
ok("raw HTML is markup when the app opts in", opted.includes("<div>raw</div>"));

const hooked = renderToString(
  renderContent(blocks, {
    nodes: {
      code: (node) =>
        node.type === "code" ? html`<lc-code-block .code=${node.text} language=${node.info}></lc-code-block>` : nothing,
    },
  }),
  { markers: false },
);
ok("a hook draws the node its own way", hooked.includes("<lc-code-block") && !hooked.includes("<pre><code"));

done();
