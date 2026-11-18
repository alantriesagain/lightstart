/**
 * One component's page: its examples, a playground over its props, and its
 * API. It runs in two places from one definition: the catalogue app gives it
 * `category` and `name` and listens for `open`; a host that gives it `uri`
 * hands it `content` and receives `showcase-open` with `detail.uri`
 * (`showcase://component/<category>/<name>`, or `showcase://preview/...` from
 * the open-in-a-new-tab control) instead, so it can navigate.
 *
 * Everything shown comes from the component's `loadComponent` metadata and its
 * own demo. There is no scraper behind this and no map beside it.
 */
import { element, html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent, trackWork } from "@lightstart/light";
import alertDef from "@lightstart/components/feedback/alert.js";
import spinnerDef from "@lightstart/components/feedback/spinner.js";
import emptyStateDef from "@lightstart/components/feedback/empty-state.js";
import exampleDef from "@lightstart/components/display/example.js";
import panelDef from "@lightstart/components/layout/panel.js";
import buttonDef from "@lightstart/components/display/button.js";
import tableDef from "@lightstart/components/display/table.js";
import badgeDef from "@lightstart/components/display/badge.js";
import clipboardDef from "@lightstart/components/utility/clipboard.js";
import segmentedDef from "@lightstart/components/form/segmented.js";
import propertyEditorDef from "./property-editor.js";
import previewDef from "./preview.js";
import { componentTags, loadComponent, loadDemo, modulePath, stylePath } from "../lib/load.ts";
import { getDefaultValues } from "../lib/registry.ts";
import { browsableCategories, humanize } from "../lib/categories.ts";
import { codeOf } from "../lib/demos.ts";
import { themeVariables } from "../lib/theme-vars.ts";
import { applySkin, clearSkin } from "../lib/skins.ts";

/** @import { ComponentDemo } from "../lib/load.ts" */
/** @import { ComponentPropertyMeta, Renderable } from "../lib/types.ts" */
/** @import { TableColumn, TableRow } from "@lightstart/components/types.ts" */
/** @import { TypeDefinition } from "@lightstart/light/types" */

/**
 * @typedef {import("../lib/types.ts").LoadedComponent & { name: string, category: string }} SelectedComponent
 * @typedef {object} ShowcasePreviewContent
 * @property {string} [type]
 * @property {string} [category]
 * @property {string} [name]
 * @property {string} [page]
 * @property {Record<string, unknown>} [props]
 */

View.define(alertDef);
View.define(spinnerDef);
View.define(emptyStateDef);
View.define(exampleDef);
View.define(panelDef);
View.define(buttonDef);
View.define(tableDef);
View.define(badgeDef);
View.define(clipboardDef);
View.define(segmentedDef);
View.define(propertyEditorDef);
View.define(previewDef);

const HOST_THEME = "";
const FOLD_VARIABLES_AT = 12;

/** @type {Set<string>} */
const defined = new Set();

/**
 * Define `<lc-tag>` and everything its definition needs, once per page.
 * @param {string} tag
 * @param {import("../lib/types.ts").ComponentTags} table
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

export default defineComponent({
  tag: "showcase-component-doc",
  style: true,
  props: {
    category: T.string({ defaultValue: "" }),
    name: T.string({ defaultValue: "" }),
    skin: T.string({ defaultValue: HOST_THEME }),
    viewportWidth: 0,
    uri: T.string({ attribute: false }),
    content: /** @type {TypeDefinition<ShowcasePreviewContent | null>} */ (
      /** @type {unknown} */ (T.object({ attribute: false }))
    ),
    selectedComponent: /** @type {TypeDefinition<SelectedComponent | null>} */ (
      /** @type {unknown} */ (T.object({ attribute: false }))
    ),
    demo: /** @type {TypeDefinition<ComponentDemo | null>} */ (
      /** @type {unknown} */ (T.object({ attribute: false }))
    ),
    stylesheet: T.string({ attribute: false, defaultValue: "" }),
    liveProps: /** @type {TypeDefinition<Record<string, Renderable>>} */ (
      /** @type {unknown} */ (T.object({ attribute: false, defaultValue: {} }))
    ),
    loading: T.boolean(),
    error: T.string({ defaultValue: "" }),
    allVariables: T.boolean(),
    appliedSkin: T.string({ attribute: false, defaultValue: HOST_THEME }),
    _target: T.string({ reactive: false, defaultValue: "" }),
  },
  events: {
    open: T.object(),
    loaded: T.object(),
  },

  async connected() {
    await this._syncTarget();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  async willUpdate({ changedProps }) {
    if (changedProps.has("content")) await this._syncTarget();
    else if (changedProps.has("category") || changedProps.has("name")) await this._loadSelected();
    if (changedProps.has("skin")) await this._applySkin();
  },

  disconnected() {
    if (this.appliedSkin) clearSkin(this.appliedSkin);
  },

  isHosted() {
    return Boolean(this.uri);
  },

  async _syncTarget() {
    const content = this.content;
    if (content?.type === "component") {
      this.category = content.category ?? "";
      this.name = content.name ?? "";
    }
    await this._applySkin();
    await this._loadSelected();
  },

  async _applySkin() {
    const next = this.skin || HOST_THEME;
    if (next === this.appliedSkin) return;
    if (this.appliedSkin) clearSkin(this.appliedSkin);
    this.appliedSkin = next && (await applySkin(next)) ? next : HOST_THEME;
  },

  async _loadSelected() {
    const { category, name } = this;
    if (!category || !name) {
      this._target = "";
      this.selectedComponent = null;
      this.demo = null;
      this.error = "";
      return;
    }
    const target = `${category}/${name}`;
    if (this._target === target) return;
    this._target = target;
    this.selectedComponent = null;
    this.demo = null;
    this.loading = true;
    this.error = "";
    this.allVariables = false;
    try {
      await defineTag(`lc-${name}`, componentTags());
      const [metadata, demo, stylesheet] = await Promise.all([
        loadComponent(name),
        loadDemo(name),
        this._loadStylesheet(name),
      ]);
      this.selectedComponent = { name, category, ...metadata };
      this.demo = demo;
      this.stylesheet = stylesheet;
      this.liveProps = getDefaultValues(metadata.properties);
      this.$emit("loaded", { category, name, title: humanize(name), examples: demo.examples.map((example) => example.title) });
    } catch (error) {
      this._target = "";
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  },

  /** @param {string} name */
  async _loadStylesheet(name) {
    const path = stylePath(name);
    if (path === null) return "";
    try {
      const response = await trackWork(fetch(import.meta.resolve(path)), "showcase-component-doc:stylesheet");
      return response.ok ? await response.text() : "";
    } catch {
      return "";
    }
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

  _neighbours() {
    const flat = browsableCategories(componentTags()).flatMap((category) => category.components.map((name) => ({ category: category.id, name })));
    const at = flat.findIndex((entry) => entry.category === this.category && entry.name === this.name);
    return { previous: at > 0 ? flat[at - 1] : null, next: at >= 0 ? (flat[at + 1] ?? null) : null };
  },

  /** @param {{ detail: { key: string, value: Renderable } }} arg */
  _handlePropertyChange({ detail }) {
    this.liveProps = { ...this.liveProps, [detail.key]: detail.value };
  },

  _handleReset() {
    if (this.selectedComponent) this.liveProps = getDefaultValues(this.selectedComponent.properties);
  },

  _openInNewTab() {
    if (!this.selectedComponent || !this.isHosted()) return;
    const { category, name } = this.selectedComponent;
    const query = this.skin ? `?skin=${encodeURIComponent(this.skin)}` : "";
    this.dispatchEvent(new CustomEvent("showcase-open", { detail: { uri: `showcase://preview/${category}/${name}${query}` }, bubbles: true, composed: true }));
  },

  /**
   * The props the reader actually changed, as attribute pairs. A prop left at
   * its default is not written: it says nothing, and an empty string written
   * as an attribute reads back as null, which a component typed for a string
   * does not expect.
   * @returns {[string, string][]}
   */
  _changedAttributes() {
    const properties = this.selectedComponent?.properties ?? {};
    /** @type {[string, string][]} */
    const pairs = [];
    for (const [key, value] of Object.entries(this.liveProps || {})) {
      if (value === undefined || value === null || value === "") continue;
      if (value === properties[key]?.defaultValue) continue;
      const attribute = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      if (typeof value === "boolean") {
        if (value) pairs.push([attribute, ""]);
      } else if (typeof value === "string" || typeof value === "number") pairs.push([attribute, String(value)]);
    }
    return pairs;
  },

  _playgroundSnippet() {
    if (!this.selectedComponent) return "";
    const { tag } = this.selectedComponent;
    const attrs = this._changedAttributes()
      .map(([name, value]) => (value === "" ? name : `${name}="${value}"`))
      .join(" ");
    const slot = /** @type {{ slot?: () => Renderable }} */ (this.demo)?.slot;
    const inside = slot ? "…" : "";
    return `<${tag}${attrs ? ` ${attrs}` : ""}>${inside}</${tag}>`;
  },

  _renderPlaygroundElement() {
    if (!this.selectedComponent) return nothing;
    const { tag } = this.selectedComponent;
    const bindings = Object.fromEntries(this._changedAttributes());
    const slot = /** @type {{ slot?: () => Renderable }} */ (this.demo)?.slot;
    try {
      return element(tag, bindings, slot?.() ?? nothing);
    } catch {
      return html`<lc-alert variant="error">This component did not render</lc-alert>`;
    }
  },

  /** @param {ComponentPropertyMeta} meta */
  _defaultLabel(meta) {
    const value = meta.defaultValue;
    if (meta.type === "boolean") return value ? "true" : "false";
    if (value === undefined || value === null || value === "") return "—";
    if (Array.isArray(value)) return value.length ? JSON.stringify(value) : "[]";
    if (typeof value === "object") return "{…}";
    return String(value);
  },

  /** @param {number} index */
  _renderExample(index) {
    const example = /** @type {(import("../lib/demos.ts").DemoExample & { description?: string }) | undefined} */ (this.demo?.examples?.[index]);
    if (!example) return nothing;
    return html`
      <lc-example
        id=${`example-${index}`}
        class="component-doc-example"
        title=${example.title}
        description=${example.description ?? ""}
        .preview=${example.render}
        .code=${codeOf(example)}
        skin=${this.appliedSkin}
        ?viewports=${index === 0}
        viewport=${this.viewportWidth}
        @viewport-change=${(/** @type {CustomEvent<{ viewport: number }>} */ e) => { this.viewportWidth = e.detail.viewport; }}
      ></lc-example>
    `;
  },

  _renderPlayground() {
    if (!this.selectedComponent) return nothing;
    return html`
      <section class="component-doc-section" id="playground">
        <h2>Playground</h2>
        <p>Every declared prop, as a control. The markup follows what you change.</p>
        <div class="component-doc-playground">
          <lc-example class="component-doc-playground-stage" .preview=${() => this._renderPlaygroundElement()} .code=${this._playgroundSnippet()} skin=${this.appliedSkin}></lc-example>
          <lc-panel class="component-doc-playground-props" padding="sm">
            <showcase-property-editor
              .declarations=${this.selectedComponent.properties}
              .values=${this.liveProps}
              @property-change=${this._handlePropertyChange}
              @reset=${this._handleReset}
            ></showcase-property-editor>
            <lc-button size="xs" ghost icon="rotate-ccw" @click=${this._handleReset}>Reset</lc-button>
          </lc-panel>
        </div>
      </section>
    `;
  },

  /** @returns {TableColumn[]} */
  _propColumns() {
    return [
      { name: "name", label: "Name", render: (value, row) => html`<code>${String(value)}</code>${row.required ? html` <lc-badge size="sm">required</lc-badge>` : nothing}` },
      { name: "type", label: "Type", render: (value) => html`<code class="component-doc-type">${String(value)}</code>` },
      { name: "default", label: "Default" },
    ];
  },

  _renderApi() {
    if (!this.selectedComponent) return nothing;
    const { tag, properties, slots = [], parts = [] } = this.selectedComponent;
    const props = Object.entries(properties || {}).map(([key, meta]) => ({
      name: key,
      required: Boolean(meta.required),
      type: meta.enum?.length ? meta.enum.join(" | ") : meta.type,
      default: this._defaultLabel(meta),
    }));
    const variables = themeVariables(this.stylesheet, tag);
    const folded = variables.length > FOLD_VARIABLES_AT && !this.allVariables;
    const shown = folded ? variables.slice(0, FOLD_VARIABLES_AT - 2) : variables;
    const roles = variables.filter((row) => row.role).length;
    return html`
      <section class="component-doc-section" id="api">
        <h2>API</h2>
        <p>What the component declares. Props become attributes, kebab-cased when they are more than one word.</p>
        ${props.length
          ? html`<lc-table id="props" class="component-doc-table" .columns=${this._propColumns()} .rows=${props}></lc-table>`
          : html`<p class="component-doc-muted">This component declares no props.</p>`}
        ${slots.length
          ? html`
              <h3 id="slots">Slots</h3>
              <lc-table class="component-doc-table" .columns=${[{ name: "name", label: "Slot", render: (/** @type {Renderable} */ v) => html`<code>${String(v)}</code>` }, { name: "description", label: "Holds" }]} .rows=${slots}></lc-table>
            `
          : nothing}
        ${parts.length
          ? html`
              <h3 id="parts">Parts</h3>
              <lc-table class="component-doc-table" .columns=${[{ name: "name", label: "Part", render: (/** @type {Renderable} */ v) => html`<code>[part~=${String(v)}]</code>` }, { name: "description", label: "Is" }]} .rows=${parts}></lc-table>
            `
          : nothing}
        ${variables.length
          ? html`
              <h3 id="theme-variables">Theme variables <span class="component-doc-count">${variables.length}</span></h3>
              <p>${roles
                ? `The first ${roles === 1 ? "one reads" : `${roles} read`} a shape role before the component's own fallback, so a theme that sets the role restyles this component with every other one that reads it.`
                : "None of these reads a shape role; a theme restyles this component through them directly."}</p>
              <lc-table class="component-doc-table" .columns=${[{ name: "name", label: "Variable", render: (/** @type {Renderable} */ v) => html`<code>${String(v)}</code>` }, { name: "fallback", label: "Falls back to", render: (/** @type {Renderable} */ v, /** @type {TableRow} */ row) => (v ? html`<code class="component-doc-type${row.role ? " is-role" : ""}">${String(v)}</code>` : "—") }]} .rows=${shown}></lc-table>
              ${folded ? html`<lc-button size="xs" ghost @click=${() => { this.allVariables = true; }}>Show all ${variables.length} variables</lc-button>` : nothing}
            `
          : nothing}
        <lc-alert variant="note" title="Restyle through theme.js, never around a component">
          <code>lc.${tag.replace("lc-", "")}["border-radius"]</code> becomes <code>--${tag}-border-radius</code>. A skin usually needs none of these: the roles above already reach every component at once.
        </lc-alert>
      </section>
    `;
  },

  render() {
    if (this.loading)
      return html`<div class="component-doc-status"><lc-spinner size="lg"></lc-spinner><p>Loading ${this.name}</p></div>`;
    if (this.error)
      return html`<lc-empty-state icon="alert-circle" title="This component did not load" description=${this.error}></lc-empty-state>`;
    if (!this.selectedComponent) return nothing;

    const { tag } = this.selectedComponent;
    const description = this.demo?.description || this.selectedComponent.description;
    const examples = this.demo?.examples ?? [];
    const { previous, next } = this._neighbours();

    return html`
      <article class="component-doc">
        <header class="component-doc-head">
          <div class="component-doc-title">
            <h1>${humanize(this.name || "")}</h1>
            <div class="component-doc-tag">
              <code>&lt;${tag}&gt;</code>
              <lc-clipboard size="xs" icon-only text=${`<${tag}></${tag}>`}></lc-clipboard>
            </div>
          </div>
          <lc-flex gap="sm" class="component-doc-nav">
            <lc-button size="xs" border icon="chevron-left" icon-only ?disabled=${!previous} title=${previous ? humanize(previous.name) : "First component"} @click=${() => previous && this.open(previous.category, previous.name)}></lc-button>
            <lc-button size="xs" border icon="chevron-right" icon-only ?disabled=${!next} title=${next ? humanize(next.name) : "Last component"} @click=${() => next && this.open(next.category, next.name)}></lc-button>
            ${this.isHosted()
              ? html`<lc-button size="xs" border icon="maximize-2" icon-only title="Open in a new tab" @click=${this._openInNewTab}></lc-button>`
              : nothing}
          </lc-flex>
        </header>

        ${description ? html`<p class="component-doc-lede">${description}</p>` : nothing}

        <section class="component-doc-section" id="examples">
          <h2>Examples</h2>
          <p>Each one is a real render of the component, in the skin picked above. Switch to Code for the markup that produced it.</p>
          ${examples.length
            ? examples.map((_unused, index) => this._renderExample(index))
            : html`<p class="component-doc-muted">This component has no demo yet.</p>`}
        </section>

        ${this._renderPlayground()}
        ${this._renderApi()}
      </article>
    `;
  },
});
