/**
 * The catalogue: every component as a card, in its category, each card a live
 * miniature of the component from its demo's `preview`, plus a sink of real
 * controls that wears the chosen skin. `category` narrows it to one category
 * and drops the lead.
 *
 * A host that gives it `uri` hosts the catalogue itself: picking a component
 * dispatches `showcase-open` with `detail.uri` (`showcase://component/<category>/<name>`)
 * instead of `open`, so the host can navigate to it.
 */
import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent } from "@lightstart/light";
import presets from "@lightstart/light/theme/presets.js";
import skeletonDef from "@lightstart/components/feedback/skeleton.js";
import flexDef from "@lightstart/components/layout/flex.js";
import buttonDef from "@lightstart/components/display/button.js";
import emptyStateDef from "@lightstart/components/feedback/empty-state.js";
import sinkDef from "./sink.js";
import { componentTags, loadDemo } from "../lib/load.ts";
import { browsableCategories, humanize } from "../lib/categories.ts";
import { applySkin, clearSkin } from "../lib/skins.ts";

/** @import { Renderable } from "../lib/types.ts" */
/** @import { TypeDefinition } from "@lightstart/light/types" */

/**
 * @typedef {object} CardPreview
 * @property {() => Renderable} render
 * @property {number} width
 */

View.define(skeletonDef);
View.define(flexDef);
View.define(buttonDef);
View.define(emptyStateDef);
View.define(sinkDef);

const HOST_THEME = "";
const CARD_WIDTH = 200;

const view = defineComponent({
  tag: "showcase-catalogue",
  style: true,
  props: {
    search: "",
    category: "",
    skin: T.string({ defaultValue: HOST_THEME }),
    uri: T.string({ attribute: false }),
    content: T.object({ attribute: false }),
    previews: /** @type {TypeDefinition<Record<string, CardPreview | null>>} */ (
      /** @type {unknown} */ (T.object({ attribute: false, defaultValue: {} }))
    ),
    appliedSkin: T.string({ attribute: false, defaultValue: HOST_THEME }),
    _observer: /** @type {TypeDefinition<IntersectionObserver | null>} */ (
      /** @type {unknown} */ (T.object({ attribute: false, defaultValue: null, reactive: false }))
    ),
  },
  events: {
    open: T.object(),
  },

  async connected() {
    await this._applySkin();
    this.$own(() => this._observer?.disconnect());
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  async willUpdate({ changedProps }) {
    if (changedProps.has("skin")) await this._applySkin();
  },

  disconnected() {
    if (this.appliedSkin) clearSkin(this.appliedSkin);
  },

  isHosted() {
    return Boolean(this.uri);
  },

  async _applySkin() {
    const next = this.skin || HOST_THEME;
    if (next === this.appliedSkin) return;
    if (this.appliedSkin) clearSkin(this.appliedSkin);
    this.appliedSkin = next && (await applySkin(next)) ? next : HOST_THEME;
  },

  /**
   * @param {string} category
   * @param {string} name
   */
  open(category, name) {
    if (this.isHosted()) {
      this.dispatchEvent(new CustomEvent("showcase-open", { detail: { uri: `showcase://component/${category}/${name}` }, bubbles: true, composed: true }));
      return;
    }
    this.$emit("open", { category, name });
  },

  /** @param {string} name */
  async _loadPreview(name) {
    if (name in this.previews) return;
    this.previews = { ...this.previews, [name]: null };
    const demo = /** @type {import("../lib/load.ts").ComponentDemo & { preview?: () => Renderable, previewWidth?: number }} */ (await loadDemo(name));
    this.previews = { ...this.previews, [name]: demo.preview ? { render: demo.preview, width: demo.previewWidth ?? 0 } : null };
  },

  updated() {
    if (typeof IntersectionObserver === "undefined") return;
    this._observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          const name = /** @type {HTMLElement} */ (entry.target).dataset.name;
          if (name) this._loadPreview(name);
          this._observer?.unobserve(entry.target);
        }
    }, { rootMargin: "400px 0px" });
    for (const card of this.querySelectorAll(".catalogue-card:not([data-watched])")) {
      card.setAttribute("data-watched", "");
      this._observer.observe(card);
    }
  },

  /**
   * @param {string} category
   * @param {string} name
   */
  _renderCard(category, name) {
    const preview = this.previews[name];
    return html`
      <button type="button" class="catalogue-card" data-name=${name} @click=${() => this.open(category, name)}>
        <span class="catalogue-card-preview" data-lc-skin=${this.appliedSkin || nothing} inert>
          ${preview
            ? preview.width
              ? html`<span class="catalogue-card-scaled" style=${`width: ${preview.width}px; zoom: ${(CARD_WIDTH / preview.width).toFixed(3)}`}>${preview.render()}</span>`
              : preview.render()
            : name in this.previews
              ? html`<code class="catalogue-card-chip">lc-${name}</code>`
              : html`<lc-skeleton width="60%" height="1.5rem"></lc-skeleton>`}
        </span>
        <span class="catalogue-card-name">
          <span>${humanize(name)}</span>
          <code>${name}</code>
        </span>
      </button>
    `;
  },

  _renderLead() {
    const total = browsableCategories(componentTags()).reduce((sum, category) => sum + category.components.length, 0);
    const wearing = presets.find((preset) => preset.name === this.appliedSkin)?.label ?? "the project theme";
    return html`
        <section class="catalogue-lead">
          <div class="catalogue-lead-copy">
            <h1>${total} components,<br>one theme, any look.</h1>
            <p>Every lc component reads the same tokens, so a skin redresses all of them at once. Pick one above and watch the sink on the right change clothes.</p>
            <lc-flex gap="sm" class="catalogue-lead-actions">
              <lc-button primary href="#form">Browse components</lc-button>
              <lc-button border href="/theming">Read the theming guide</lc-button>
            </lc-flex>
          </div>
          <div class="catalogue-lead-sink">
            <showcase-sink skin=${this.appliedSkin}></showcase-sink>
            <p class="catalogue-wearing">Wearing <b>${wearing}</b> · every control above is a real lc component</p>
          </div>
        </section>
    `;
  },

  render() {
    const listings = browsableCategories(componentTags(), this.search).filter((category) => !this.category || category.id === this.category);
    return html`
      <div class="catalogue">
        ${this.category ? nothing : this._renderLead()}
        ${listings.length
          ? listings.map(
              (category) => html`
                <section class="catalogue-category" id=${category.id}>
                  <div class="catalogue-category-head">
                    <h2>${category.label}</h2>
                    <span class="catalogue-count">${category.components.length}</span>
                    <p>${category.description}</p>
                  </div>
                  <div class="catalogue-grid">${category.components.map((name) => this._renderCard(category.id, name))}</div>
                </section>
              `,
            )
          : html`<lc-empty-state icon="search-x" title=${`Nothing matches "${this.search}"`}></lc-empty-state>`}
      </div>
    `;
  },
});

View.define(view);

export default view;
