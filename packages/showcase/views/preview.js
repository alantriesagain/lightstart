/**
 * One component on its own, at a chosen width and in a chosen skin.
 *
 * The showcase opens this in a new IDE tab to get a component away from the
 * catalogue's chrome. It renders the same demo the showcase does, through the
 * same module, so the two cannot show different things.
 */
import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent, trackWork } from "@lightstart/light";
import { componentTags, loadDemo, modulePath, stylePath } from "../lib/load.ts";
import { applySkin, clearSkin } from "../lib/skins.ts";
import {
  sliderFromViewport,
  VIEWPORT_MAX,
  VIEWPORT_PRESETS,
  viewportCss,
  viewportFromSlider,
  viewportLabel,
} from "@lightstart/components/utils/viewport.js";

/** @import { ComponentDemo } from "../lib/load.ts" */
/** @import { ComponentTags, Renderable } from "../lib/types.ts" */
/** @import { TypeDefinition } from "@lightstart/light/types" */

/**
 * @typedef {object} ShowcasePreviewContent
 * @property {string} [type]
 * @property {string} [category]
 * @property {string} [name]
 * @property {string} [page]
 * @property {Record<string, unknown>} [props]
 */

/** @type {Set<string>} */
const defined = new Set();

/** @type {Set<string>} */
const styled = new Set();

/**
 * Define `<lc-tag>` and everything its definition needs, once per page.
 * @param {string} tag
 * @param {ComponentTags} table
 * @returns {Promise<void>}
 */
const defineTag = async (tag, table) => {
  if (defined.has(tag) || customElements.get(tag)) return;
  const entry = table[tag];
  if (entry === undefined) return;
  defined.add(tag);
  try {
    if (entry.extends) await defineTag(entry.extends, table);
    const module = await import(modulePath(tag.replace(/^lc-/, ""), table));
    View.define(module.default);
    await Promise.all((entry.uses ?? []).map((used) => defineTag(used, table)));
  } catch (error) {
    defined.delete(tag);
    throw error;
  }
};

/**
 * Add a component's stylesheet to the page, once per page.
 * @param {string} name
 * @returns {Promise<void>}
 */
const loadStyle = async (name) => {
  const path = stylePath(name);
  if (path === null) return;
  const href = import.meta.resolve(path);
  if (styled.has(href)) return;
  styled.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
};

export default defineComponent({
  tag: "showcase-preview",
  style: true,
  props: {
    uri: T.string({ attribute: false }),
    content: /** @type {TypeDefinition<ShowcasePreviewContent>} */ (
      /** @type {unknown} */ (T.object({ attribute: false }))
    ),
    name: T.string(),
    skin: "",
    example: 0,
    demo: /** @type {TypeDefinition<ComponentDemo | null>} */ (
      /** @type {unknown} */ (T.object({ attribute: false }))
    ),
    loading: true,
    error: /** @type {TypeDefinition<string | null>} */ (
      /** @type {unknown} */ (T.string())
    ),
    viewportWidth: 0,
    appliedSkin: T.string({ attribute: false, defaultValue: "" }),
  },

  async connected() {
    const table = componentTags();
    await Promise.all(["lc-icon", "lc-select", "lc-slider", "lc-spinner"].map((tag) => defineTag(tag, table)));
    await this._sync();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  async willUpdate({ changedProps }) {
    if (changedProps.has("content")) await this._sync();
    else if (changedProps.has("name")) await this._load();
    if (changedProps.has("skin")) await this._applySkin();
  },

  async _sync() {
    const content = this.content;
    if (content?.name) this.name = content.name;
    if (content?.props?.skin) this.skin = String(content.props.skin);
    if (content?.props?.example !== undefined) this.example = Number(content.props.example) || 0;
    await this._applySkin();
    await this._load();
  },

  async _applySkin() {
    const next = this.skin || "";
    if (next === this.appliedSkin) return;
    if (this.appliedSkin) clearSkin(this.appliedSkin);
    this.appliedSkin = next && (await applySkin(next)) ? next : "";
  },

  async _load() {
    if (!this.name) return;
    this.loading = true;
    this.error = null;
    const demo = await trackWork(
      (async () => {
        await defineTag(`lc-${this.name}`, componentTags());
        await loadStyle(this.name);
        return loadDemo(this.name);
      })(),
      `showcase:preview:${this.name}`,
    );
    this.demo = demo;
    if (!demo.examples.length) this.error = `<lc-${this.name}> has no demo`;
    this.loading = false;
  },

  /** @returns {Renderable} */
  renderExample() {
    const example = this.demo?.examples?.[this.example] ?? this.demo?.examples?.[0];
    if (!example) return nothing;
    try {
      return /** @type {Renderable} */ (example.render());
    } catch (error) {
      return html`<p>${/** @type {Error} */ (error).message}</p>`;
    }
  },

  renderToolbar() {
    const examples = this.demo?.examples ?? [];
    return html`
      <div class="showcase-preview__toolbar">
        ${
          examples.length > 1
            ? html`<lc-select
                size="xs"
                class="min-w-[140px]"
                .value=${examples[this.example]?.title}
                .options=${examples.map((item) => item.title)}
                @change=${(/** @type {CustomEvent} */ e) =>
                  (this.example = examples.findIndex((item) => item.title === e.detail.value))}
              ></lc-select>`
            : nothing
        }
        <lc-slider
          size="xs"
          min="320"
          max=${VIEWPORT_MAX}
          step="10"
          class="w-[260px]"
          .value=${sliderFromViewport(this.viewportWidth)}
          @input=${(/** @type {CustomEvent} */ e) => (this.viewportWidth = viewportFromSlider(e.detail.value))}
        ></lc-slider>
        ${VIEWPORT_PRESETS.map(
          (preset) => html`
            <button
              class="showcase-preview__preset ${this.viewportWidth === preset.width ? "is-active" : ""}"
              @click=${() => (this.viewportWidth = preset.width)}
              title=${preset.label}
            >
              <lc-icon name=${preset.icon} size="14"></lc-icon>
            </button>
          `,
        )}
        <span class="showcase-preview__width">${viewportLabel(this.viewportWidth)}</span>
      </div>
    `;
  },

  render() {
    if (this.loading)
      return html`<div class="showcase-preview__status"><lc-spinner size="lg"></lc-spinner></div>`;

    if (this.error)
      return html`
        <div class="showcase-preview__status">
          <lc-icon name="alert-circle" size="32"></lc-icon>
          <p>${this.error}</p>
        </div>
      `;

    return html`
      ${this.renderToolbar()}
      <div class="showcase-preview__frame" data-lc-skin=${this.appliedSkin || nothing}>
        <div class="showcase-preview__stage" style="width: ${viewportCss(this.viewportWidth)};">
          ${this.renderExample()}
        </div>
      </div>
    `;
  },
});
