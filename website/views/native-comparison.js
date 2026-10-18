/**
 * /native/comparison: how one program runs in a browser, in Node and native (scriptc), as
 * an `lc-flow`; the selected step explained under it with the output of the
 * tool behind it; then the differences and what the example measured. The
 * words are in `lib/native/overview.js`.
 */
import { html } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import { defineComponent } from "@bootstrapp/light";
import { DIFFERENCES, EXAMPLE, LANES, PHASES, RUNS, STEPS, TOOLS, megabytes } from "../lib/native/overview.js";
import { nativeNeighbours } from "../lib/native/pages.js";
import { prose } from "../lib/native/prose-html.js";

/** @import { TocItem } from "@bootstrapp/light/components/types.ts" */

/** @type {TocItem[]} */
const OUTLINE = [
  { id: "comparison", label: "Browser, Node and native" },
  { id: "differences", label: "Differences" },
];

const COLUMNS = [
  { name: "aspect", label: "Aspect" },
  { name: "javascript", label: "Browser and Node" },
  { name: "scriptc", label: "Native (scriptc)" },
];

export default defineComponent({
  tag: "docs-native-comparison",
  style: true,
  props: {
    step: "",
  },

  connected() {
    $APP.catalogue.toc = OUTLINE;
  },

  disconnected() {
    $APP.catalogue.toc = [];
  },

  /**
   * Show a step's page, scrolled into view when the lanes stack above it on a
   * narrow screen and it would otherwise start below the fold.
   * @param {string} step
   */
  _show(step) {
    this.step = step;
    requestAnimationFrame(() => this.$(".native-step")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  },

  _panel() {
    const page = STEPS[this.step] ?? STEPS["scriptc-source"];
    return html`
      <div class="native-step" aria-live="polite">
        <h3>${page.title}</h3>
        ${page.text.map((text) => html`<p>${prose(text)}</p>`)}
        ${page.artifacts.map(
          (artifact) => html`
            <lc-code-block
              title=${artifact.title}
              language=${artifact.language}
              .code=${artifact.code}
              .highlight=${artifact.highlight ?? ""}
              .foldAt=${artifact.foldAt ?? 0}
              ?wrap=${artifact.language === "text"}
              line-numbers
            ></lc-code-block>
          `,
        )}
        ${page.more ? html`<lc-link class="native-more" href=${page.more.href}>${page.more.label} <lc-icon name="chevron-right" size="14"></lc-icon></lc-link>` : ""}
      </div>
    `;
  },

  render() {
    const { node, native } = RUNS;
    return html`
      <div class="docs-page">
        <lc-breadcrumbs size="sm" .items=${[{ text: "Native", href: "/native", isLast: false }, { text: "Browser, Node and native", href: null, isLast: true }]}></lc-breadcrumbs>
        <h1 class="docs-title">Browser, Node and native</h1>
        <p class="docs-lede">
          How the same TypeScript program runs in a browser, in Node and as a scriptc executable, using the actual output of each tool.
        </p>

        <section id="comparison" class="native-section">
          <h2>The same program in a browser, in Node and native (scriptc)</h2>
          <p>
            The browser and Node remove the types and run the JavaScript in V8, which compiles it to machine code while it runs. scriptc uses the types to compile the program to machine code before it runs. Each step below shows the output of the tool that performs it.
          </p>
          <lc-flow
            .phases=${PHASES}
            .lanes=${LANES}
            selected=${this.step}
            @flow-select=${(/** @type {CustomEvent} */ e) => this._show(e.detail.step)}
          ></lc-flow>
          ${this._panel()}
        </section>

        <section id="differences" class="native-section">
          <h2>Differences</h2>
          <lc-table .columns=${COLUMNS} .rows=${DIFFERENCES}></lc-table>
          <div class="native-stats">
            <lc-stat title="Run time, Node" value=${`${node.ms} ms`} desc=${`fastest of ${TOOLS.runs} runs`}></lc-stat>
            <lc-stat title="Run time, native" value=${`${native.ms} ms`} desc=${`fastest of ${TOOLS.runs} runs`} variant="primary"></lc-stat>
            <lc-stat title="Peak memory, Node" value=${megabytes(node.rssKb * 1e3)} desc="resident set size"></lc-stat>
            <lc-stat title="Peak memory, native" value=${megabytes(native.rssKb * 1e3)} desc="resident set size" variant="primary"></lc-stat>
          </div>
          <p class="native-note">
            ${EXAMPLE.file}, measured on ${TOOLS.platform} with scriptc ${TOOLS.scriptc}, tsc-ts ${TOOLS.tscTs} and node ${TOOLS.node}, ${TOOLS.capturedAt}. For a program this short, most of Node's time is startup: node with an empty program takes ${RUNS.nodeEmpty.ms} ms.
          </p>
        </section>

        <lc-pagination class="docs-pager" variant="pager" .previousLink=${nativeNeighbours("comparison").previous} .nextLink=${nativeNeighbours("comparison").next}></lc-pagination>
      </div>
    `;
  },
});
