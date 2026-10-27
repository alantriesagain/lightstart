/**
 * The live side of the home page's first pairs: `my-counter`, defined the way
 * the snippet beside it says, so what the reader clicks is what they read.
 * `View.define` takes the same arguments again as a no-op, so the page may
 * call `defineDemos()` every time it connects.
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

const props = { label: "Clicks", count: 0, big: false };

/** @param {import("@lightstart/light/view/types.ts").ElementOf<[], typeof props, {}>} el */
const render = (el) => html`<button type="button" ?data-big=${el.big} @click=${() => el.count++}>${el.label}: ${el.count}</button>`;

export const defineDemos = () => {
  View.define("my-counter", props, render);
};
