import { html, nothing } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { lcText } from "../utils/text.js";
import { VIEWPORT_PRESETS, viewportCss } from "../utils/viewport.js";
/** @import { Prop } from "../types.js" */

const TAG = "lc-example";
const VIEW_OPTIONS = ["preview", "code"];

/**
 * Example Component
 *
 * @component
 * @category display
 * @tag lc-example
 *
 * A rendered example beside the code that produced it: a stage that can wear
 * a skin and take a device width, and a Preview/Code switch. The page passes
 * the render function and the snippet; the stage is where the render lands.
 *
 * @example
 * ```html
 * <lc-example title="Basic" .preview=${() => html`<lc-button>Save</lc-button>`} code="<lc-button>Save</lc-button>"></lc-example>
 * ```
 */
export default defineComponent({
  tag: "lc-example",
  style: true,
  props: {
    preview: /** @type {Prop<(() => import("/app/light/html/index.js").TemplateValue) | null>} */ (T.function()),
    code: "",
    language: "html",
    title: "",
    description: "",
    view: T.string({ defaultValue: "preview", enum: ["preview", "code", "both"] }),
    viewport: 0,
    viewports: T.boolean(),
    skin: "",
    align: T.string({ defaultValue: "center", enum: ["start", "center"] }),
  },
  events: {
    "view-change": T.object(),
    "viewport-change": T.object(),
  },
  _viewOptions() {
    return VIEW_OPTIONS.map((value) => ({ value, label: lcText(TAG, value) }));
  },
  _viewportOptions() {
    return VIEWPORT_PRESETS.map((preset) => ({ value: String(preset.width), label: preset.label, icon: preset.icon }));
  },
  render() {
    const showStage = this.view !== "code";
    const showCode = this.view !== "preview" && !!this.code;
    const firstLine = this.code.split("\n")[0] ?? "";
    return html`
      ${this.title || this.description || this.code || this.viewports
        ? html`
            <div class="example-header">
              <div class="example-heading">
                ${this.title ? html`<span class="example-title">${this.title}</span>` : nothing}
                ${this.description ? html`<span class="example-description">${this.description}</span>` : nothing}
              </div>
              ${this.code
                ? html`<lc-segmented class="example-view" size="sm" .options=${this._viewOptions()} value=${this.view === "both" ? "preview" : this.view} @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => { this.view = e.detail.value; this.$emit("view-change", { view: this.view }); }}></lc-segmented>`
                : nothing}
              ${this.viewports
                ? html`<lc-segmented class="example-viewports" size="sm" .options=${this._viewportOptions()} value=${String(this.viewport)} @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => { this.viewport = Number(e.detail.value); this.$emit("viewport-change", { viewport: this.viewport }); }}></lc-segmented>`
                : nothing}
            </div>
          `
        : nothing}
      ${showStage
        ? html`
            <div class="example-stage" data-lc-skin=${this.skin ? this.skin : nothing} data-align=${this.align}>
              <div class="example-stage-inner" style=${`width: ${viewportCss(this.viewport)};`}>${this.preview ? this.preview() : nothing}</div>
            </div>
          `
        : nothing}
      ${showCode ? html`<lc-code-block class="example-code" .code=${this.code} language=${this.language} line-numbers></lc-code-block>` : nothing}
      ${this.view === "preview" && this.code
        ? html`
            <div class="example-strip">
              <code class="example-strip-code">${firstLine}${this.code.includes("\n") ? " …" : ""}</code>
              <lc-clipboard size="xs" .text=${this.code}></lc-clipboard>
            </div>
          `
        : nothing}
    `;
  },
});
