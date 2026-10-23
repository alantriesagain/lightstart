/**
 * `<lc-example>`: the preview renders into the stage, Code shows the
 * snippet through a code block, a viewport sets the stage's width, and the
 * strip under a preview carries the first line and a copy control.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { html } from "@bootstrapp/light/html";
import View from "@bootstrapp/light";
import buttonDef from "@bootstrapp/light/components/display/button.js";
import codeBlockDef from "@bootstrapp/light/components/display/code-block.js";
import exampleDef from "@bootstrapp/light/components/display/example.js";
import segmentedDef from "@bootstrapp/light/components/form/segmented.js";
import clipboardDef from "@bootstrapp/light/components/utility/clipboard.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("lc-example", () => {
  /** @type {any} */
  let el;

  before(async () => {
    define("lc-button", buttonDef);
    define("lc-clipboard", clipboardDef);
    define("lc-code-block", codeBlockDef);
    define("lc-segmented", segmentedDef);
    define("lc-example", exampleDef);
    el = document.createElement("lc-example");
    el.title = "Basic";
    el.code = "<lc-button>Save</lc-button>\n<lc-button>Cancel</lc-button>";
    el.preview = () => html`<lc-button>Save</lc-button>`;
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => el.remove());

  it("renders the preview into the stage with the first line of code beneath", () => {
    assert.ok(el.querySelector(".example-stage lc-button"), "the preview is on the stage");
    assert.match(el.querySelector(".example-strip-code").textContent, /^<lc-button>Save<\/lc-button> …/);
    assert.ok(el.querySelector(".example-strip lc-clipboard"));
  });

  it("switching to Code shows the snippet in a code block and hides the stage", async () => {
    await rendered(el.querySelector(".example-view"));
    await settle();
    const [, code] = el.querySelectorAll(".example-view .segmented-option");
    code.click();
    await rendered(el);
    await settle();
    assert.equal(el.view, "code");
    assert.equal(el.querySelector(".example-stage"), null);
    assert.equal(el.querySelector("lc-code-block").code, el.code);
  });

  it("a viewport narrows the stage", async () => {
    el.view = "preview";
    el.viewport = 375;
    await rendered(el);
    assert.equal(el.querySelector(".example-stage-inner").style.width, "375px");
  });

  it("wears the skin it is given", async () => {
    el.skin = "neobrutalist";
    await rendered(el);
    assert.equal(el.querySelector(".example-stage").getAttribute("data-lc-skin"), "neobrutalist");
  });
});
