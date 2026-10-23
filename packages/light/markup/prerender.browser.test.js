import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { configure, html, key, render } from "@bootstrapp/light/html";
import { DomHost } from "@bootstrapp/light/dom/host.js";
import { MRoot, MarkupHost, serialize } from "@bootstrapp/light/markup/index.js";
import { effect, signal } from "@bootstrapp/light/signals";

if (typeof document === "undefined")
  throw new Error("document is not defined; browser-only suite, run with --browser");

/**
 * Render `template` on the markup host and answer the markup a server would
 * send, then put the browser host back.
 * @param {unknown} template
 */
const prerender = (template) => {
  configure({ host: new MarkupHost(), effect });
  try {
    const root = new MRoot();
    render(template, root);
    return serialize(root);
  } finally {
    configure({ host: new DomHost(), effect });
  }
};

describe("light/markup prerender round trip", () => {
  /** @type {HTMLDivElement} */
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    configure({ host: new DomHost(), effect });
  });

  it("serves markup the browser adopts without replacing nodes, then updates in place", () => {
    let hits = 0;
    const count = signal(0);
    const view = (/** @type {string[]} */ items, /** @type {string} */ label) =>
      html`<section class="list ${"x"}"><button @click=${() => hits++}>${label}</button><ul>${items.map((i) => key(i, html`<li>${i}</li>`))}</ul><p>${() => count.value}</p></section>`;
    container.innerHTML = prerender(view(["a", "b"], "press"));
    assert.equal(container.querySelector("section")?.getAttribute("class"), "list x");
    assert.equal(container.textContent, "pressab0");
    const section = container.querySelector("section");
    const button = container.querySelector("button");
    const [liA, liB] = container.querySelectorAll("li");
    render(view(["a", "b"], "press"), container, { adopt: "bind" });
    assert.equal(container.querySelector("section"), section);
    assert.equal(container.querySelector("button"), button);
    /** @type {HTMLButtonElement} */ (button).click();
    assert.equal(hits, 1);
    render(view(["b", "a"], "pressed"), container, { adopt: "bind" });
    assert.deepEqual([...container.querySelectorAll("li")], [liB, liA]);
    assert.equal(button?.textContent, "pressed");
    count.value = 2;
    assert.equal(container.querySelector("p")?.textContent, "2");
  });

  it("escapes text and attributes the way the browser serializes them", () => {
    const view = () => html`<p title=${"a\"b&c"}>${"<i>&</i>"}</p>`;
    const served = prerender(view());
    container.innerHTML = served;
    render(view(), container, { adopt: "bind" });
    assert.equal(container.querySelector("p")?.getAttribute("title"), "a\"b&c");
    assert.equal(container.querySelector("p")?.textContent, "<i>&</i>");
    assert.equal(container.querySelectorAll("i").length, 0);
  });
});
