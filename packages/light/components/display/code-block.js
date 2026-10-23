import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { highlightLines } from "../utils/highlight.js";
import { lcText } from "../utils/text.js";

const TAG = "lc-code-block";

/**
 * The line numbers a `highlight` names: "3,5-7" marks 3, 5, 6 and 7.
 * @param {string} text
 */
const markedLines = (text) => {
  /** @type {Set<number>} */
  const marks = new Set();
  for (const part of text.split(",")) {
    const [from, to] = part.trim().split("-").map(Number);
    if (!from) continue;
    for (let line = from; line <= (to || from); line++) marks.add(line);
  }
  return marks;
};

/**
 * Code Block Component
 *
 * @component
 * @category display
 * @tag lc-code-block
 *
 * A snippet, coloured by the tokenizer the host configures (plain until one does), with a copy control. Sizes to
 * its content; a long one folds after `fold-at` lines until the reader asks.
 *
 * @example
 * ```html
 * <lc-code-block language="html" code="<lc-button primary>Save</lc-button>"></lc-code-block>
 * <lc-code-block language="javascript" title="routes.js" line-numbers fold-at="8" .code=${source}></lc-code-block>
 * ```
 */
export default defineComponent({
  tag: "lc-code-block",
  style: true,
  props: {
    code: "",
    language: "html",
    title: "",
    lineNumbers: T.boolean(),
    copy: true,
    foldAt: 0,
    expanded: T.boolean(),
    wrap: T.boolean(),
    highlight: "",
  },
  render() {
    const lines = highlightLines(this.code, this.language);
    const folded = this.foldAt > 0 && lines.length > this.foldAt && !this.expanded;
    const shown = folded ? lines.slice(0, this.foldAt) : lines;
    const marks = markedLines(this.highlight);
    return html`
      ${this.title || this.copy
        ? html`
            <div class="code-block-header">
              ${this.title ? html`<span class="code-block-title">${this.title}</span>` : ""}
              ${this.copy ? html`<lc-clipboard class="code-block-copy" size="xs" text=${this.code}></lc-clipboard>` : ""}
            </div>
          `
        : ""}
      <pre class="code-block-pre"><code class="code-block-code">${shown.map(
        (runs, index) => html`<span class="code-block-line" ?data-marked=${marks.has(index + 1)}>${
          this.lineNumbers ? html`<span class="code-block-gutter">${index + 1}</span>` : ""
        }${runs.map((run) => (run.type ? html`<span class="tok-${run.type}">${run.text}</span>` : run.text))}</span>`,
      )}</code></pre>
      ${folded
        ? html`
            <lc-button class="code-block-fold" ghost size="xs" @click=${() => { this.expanded = true; }}>
              ${lcText(TAG, "showAll", { count: lines.length })}
            </lc-button>
          `
        : ""}
    `;
  },
});
