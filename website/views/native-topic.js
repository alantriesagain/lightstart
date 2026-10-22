/**
 * /native/:topic: one page of the native section, drawn from its definition in
 * `lib/native/topics.js`: a title, a lede, and sections of blocks (words,
 * lists, captured code, side-by-side code, tables, stats, bars, notes, flows),
 * with the outline handed to the shell's aside and a pager to the next page.
 * Captured tool output wraps, and so does everything side by side; source
 * code on its own keeps its lines.
 */
import { html, nothing } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import navigation from "@bootstrapp/light/navigation";
import { prose } from "../lib/native/prose-html.js";
import { nativeNeighbours } from "../lib/native/pages.js";
import { TOPICS } from "../lib/native/topics.js";

/** @import { Block, CodeBlock } from "../lib/native/topics.js" */

/**
 * @param {CodeBlock} block
 * @param {boolean} [narrow] in a column beside another block, where every line wraps
 */
const code = (block, narrow = false) => html`
  <lc-code-block title=${block.title} language=${block.language} .code=${block.code} .highlight=${block.highlight ?? ""} .foldAt=${block.foldAt ?? 0} ?wrap=${narrow || block.language === "text"} line-numbers></lc-code-block>
`;

/**
 * A table column as `lc-table` takes it: a `code` column draws its cells as code on one line.
 * @param {{ name: string, label: string, code?: boolean }} column
 */
const columnOf = ({ code: isCode, ...column }) =>
  isCode ? { ...column, render: (/** @type {unknown} */ value) => html`<code class="topic-cell-code">${String(value)}</code>` } : column;

/** @param {Block} block */
const blockOf = (block) => {
  switch (block.kind) {
    case "text":
      return html`<p>${prose(block.text)}</p>`;
    case "list":
      return html`<ul class="topic-list">${block.items.map((item) => html`<li>${prose(item)}</li>`)}</ul>`;
    case "code":
      return code(block);
    case "compare":
      return html`<div class="topic-compare">${block.items.map((item) => code(item, true))}</div>`;
    case "table":
      return html`<lc-table .columns=${block.columns.map(columnOf)} .rows=${block.rows}></lc-table>`;
    case "stats":
      return html`<div class="topic-stats">${block.items.map((stat) => html`<lc-stat title=${stat.title} value=${stat.value} desc=${stat.desc ?? ""} variant=${stat.variant ?? "default"}></lc-stat>`)}</div>`;
    case "bars":
      return html`
        <figure class="topic-bars">
          <figcaption>${block.title}</figcaption>
          <lc-bar-chart .data=${block.data} horizontal show-values></lc-bar-chart>
        </figure>
      `;
    case "note":
      return html`<lc-alert variant=${block.variant ?? "note"} title=${block.title ?? ""}>${prose(block.text)}</lc-alert>`;
    case "flow":
      return html`<lc-flow .phases=${block.phases ?? []} .lanes=${block.lanes}></lc-flow>`;
    default:
      return nothing;
  }
};

export default defineComponent({
  tag: "docs-native-topic",
  style: true,
  props: {
    topic: T.string(),
  },

  connected() {
    this._outline();
  },

  /** @param {{ changedProps?: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    this._outline();
    if (!changedProps || changedProps.has("topic")) this._reveal();
  },

  _reveal() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return window.scrollTo({ top: 0 });
    requestAnimationFrame(() => this.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: "start" }));
  },

  disconnected() {
    $APP.catalogue.toc = [];
  },

  _outline() {
    const page = TOPICS[this.topic];
    const toc = page ? page.sections.map((section) => ({ id: section.id, label: section.title })) : [];
    if (JSON.stringify(toc) !== JSON.stringify($APP.catalogue.toc)) $APP.catalogue.toc = toc;
  },

  render() {
    const page = TOPICS[this.topic];
    if (!page)
      return html`
        <div class="docs-page">
          <h1 class="docs-title">Not found</h1>
          <p class="docs-lede">There is no native page named ${this.topic}. The <a class="native-link" href=${navigation.href("/native")}>overview</a> lists the pages.</p>
        </div>
      `;
    const { previous, next } = nativeNeighbours(this.topic);
    return html`
      <div class="docs-page">
        <lc-breadcrumbs size="sm" .items=${[{ text: "Native", href: "/native", isLast: false }, { text: page.title, href: null, isLast: true }]}></lc-breadcrumbs>
        <h1 class="docs-title">${page.title}</h1>
        <p class="docs-lede">${prose(page.lede)}</p>
        ${page.sections.map(
          (section) => html`
            <section id=${section.id} class="topic-section">
              <h2>${section.title}</h2>
              ${section.blocks.map(blockOf)}
            </section>
          `,
        )}
        <lc-pagination class="docs-pager" variant="pager" .previousLink=${previous} .nextLink=${next}></lc-pagination>
      </div>
    `;
  },
});
