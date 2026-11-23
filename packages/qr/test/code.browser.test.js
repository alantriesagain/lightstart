import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import { encode } from "../encode.js";
import qrDef from "../views/code.js";

/** @typedef {HTMLElement & { value: string }} QrElement */

/** @type {QrElement} */
let el;

/**
 * @param {() => unknown} predicate
 * @param {string} label
 * @param {number} [timeout]
 */
const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe("qr-code", () => {
  before(() => {
    if (!customElements.get("qr-code")) View.define("qr-code", qrDef);
    el = /** @type {QrElement} */ (document.createElement("qr-code"));
    el.setAttribute("value", "https://example.com/#peer=abc");
    el.setAttribute("size", "160");
    document.body.appendChild(el);
  });

  after(() => el.remove());

  it("renders one path inside a sized, labelled svg whose viewBox carries the quiet zone", async () => {
    await waitFor(() => el.querySelector("svg path"), "svg path");
    const svgEl = /** @type {SVGSVGElement} */ (el.querySelector("svg"));
    const matrix = encode("https://example.com/#peer=abc", { level: "M" });
    assert.equal(svgEl.getAttribute("viewBox"), `0 0 ${matrix.size + 2} ${matrix.size + 2}`);
    assert.equal(svgEl.getAttribute("width"), "160");
    assert.equal(svgEl.getAttribute("role"), "img");
    assert.equal(svgEl.dataset.version, String(matrix.version));
    assert.equal(el.querySelectorAll("path").length, 1);
  });

  it("draws the top-left finder as the first run of seven", async () => {
    await waitFor(() => el.querySelector("svg path"), "svg path");
    assert.ok((/** @type {Element} */ (el.querySelector("path")).getAttribute("d") ?? "").startsWith("M1 1h7v1h-7z"));
  });

  it("re-encodes when the value changes and clears when it is empty", async () => {
    el.value = "another payload that is a good deal longer than the first one";
    await waitFor(() => /** @type {SVGSVGElement | null} */ (el.querySelector("svg"))?.dataset.version === "3", "version 3 symbol");
    el.value = "";
    await waitFor(() => !el.querySelector("svg"), "no svg for an empty value");
  });
});
