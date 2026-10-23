import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { html, nothing, render } from "@bootstrapp/light/html";

if (typeof document === "undefined")
  throw new Error("document is not defined; browser-only suite, run with --browser");

const { html: litHtml, nothing: litNothing, render: litRender } = await import("https://esm.sh/lit-html@3");

const canonicalize = (node) => {
  if (node.nodeType === 3) return node.data;
  if (node.nodeType === 8) return "";
  const el = node;
  const attrs = [...(el.attributes ?? [])]
    .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
    .sort()
    .join(" ");
  const children = [...el.childNodes].map(canonicalize).join("");
  const tag = el.tagName ? el.tagName.toLowerCase() : "";
  return tag ? `<${tag}${attrs ? ` ${attrs}` : ""}>${children}</${tag}>` : children;
};

const canonicalContainer = (container) =>
  [...container.childNodes].map(canonicalize).join("").replace(/\s+/g, " ");

const CASES = [
  {
    name: "text primitives",
    steps: [["hello"], [42], [false], [""]],
    tpl: (h, n, v) => h`<div>${v}</div>`,
  },
  {
    name: "single attribute nothing/null/undefined removal",
    steps: [["a"], [null], ["b"], [undefined], ["c"], ["NOTHING"]],
    tpl: (h, n, v) => h`<div data-x=${v === "NOTHING" ? n : v}></div>`,
  },
  {
    name: "composite attribute with nothing and null",
    steps: [[["x", "y"]], [[null, "y"]], [["NOTHING", "y"]], [["x", undefined]]],
    tpl: (h, n, v) => h`<div class="a ${v[0] === "NOTHING" ? n : v[0]} b ${v[1]} c"></div>`,
  },
  {
    name: "boolean attribute",
    steps: [[true], [false], [1], [0], [""], ["x"]],
    tpl: (h, n, v) => h`<input ?disabled=${v} />`,
  },
  {
    name: "child nothing/null clears",
    steps: [["content"], [null], ["again"], ["NOTHING"], [undefined]],
    tpl: (h, n, v) => h`<p>${v === "NOTHING" ? n : v}</p>`,
  },
  {
    name: "arrays grow and shrink",
    steps: [[["a", "b", "c"]], [["a"]], [[]], [["x", "y"]]],
    tpl: (h, n, v) => h`<ul>${v.map((i) => h`<li>${i}</li>`)}</ul>`,
  },
  {
    name: "nested template branch swap",
    steps: [[true], [false], [true]],
    tpl: (h, n, v) => h`<div>${v ? h`<b>yes</b>` : h`<i>no</i>`}</div>`,
  },
  {
    name: "mixed static and bound attributes",
    steps: [["v1"], ["v2"]],
    tpl: (h, n, v) => h`<div id="fixed" data-dyn=${v} role="note">${v}</div>`,
  },
  {
    name: "unquoted attribute binding",
    steps: [["one"], ["two"]],
    tpl: (h, n, v) => h`<input type="text" value=${v} />`,
  },
  {
    name: "table rows",
    steps: [[["r1", "r2"]], [["r1"]]],
    tpl: (h, n, v) => h`<table><tbody>${v.map((r) => h`<tr><td>${r}</td></tr>`)}</tbody></table>`,
  },
  {
    name: "deep nesting",
    steps: [["x"], ["y"]],
    tpl: (h, n, v) => h`<div><section>${h`<article>${h`<span>${v}</span>`}</article>`}</section></div>`,
  },
  {
    name: "iterables of primitives",
    steps: [[["a", "b"]], [["c"]]],
    tpl: (h, n, v) => h`<div>${v}</div>`,
  },
];

describe("light/html parity with lit-html", () => {
  describe("rendered output matches lit-html step by step", () => {
    for (const c of CASES)
      it(c.name, () => {
        const ourContainer = document.createElement("div");
        const litContainer = document.createElement("div");
        document.body.append(ourContainer, litContainer);
        try {
          for (const args of c.steps) {
            render(c.tpl(html, nothing, ...args), ourContainer);
            litRender(c.tpl(litHtml, litNothing, ...args), litContainer);
            assert.equal(
              canonicalContainer(ourContainer),
              canonicalContainer(litContainer),
              `step ${JSON.stringify(args)}`,
            );
          }
        } finally {
          ourContainer.remove();
          litContainer.remove();
        }
      });
  });
});
