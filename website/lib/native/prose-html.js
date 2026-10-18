/**
 * The native pages' words as template parts: `code` runs as `<code>`, a
 * defined term as `<b>`, links
 * as plain anchors inside the sentence (a site path through the host's
 * router, so it follows the deploy's base path; an external one opens in a
 * new tab). `prose.js` reads the marks; this
 * draws them for both native views.
 */
import { html } from "@bootstrapp/light/html";
import navigation from "@bootstrapp/light/navigation";
import { runsOf } from "./prose.js";

/** @param {import("./prose.js").Run} run */
const partOf = (run) => {
  switch (run.kind) {
    case "code":
      return html`<code>${run.text}</code>`;
    case "term":
      return html`<b>${run.text}</b>`;
    case "link":
      return /^https?:/.test(run.href)
        ? html`<a class="native-link" href=${run.href} target="_blank" rel="external noopener">${run.text}</a>`
        : html`<a class="native-link" href=${navigation.href(run.href)}>${run.text}</a>`;
    default:
      return run.text;
  }
};

/** @param {string} text */
export const prose = (text) => runsOf(text).map(partOf);
