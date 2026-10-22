/**
 * The landing page: what Light is, in a hero, three facts, two principles, an
 * index of what the package holds and, for each entry, the code beside what
 * it does. The results are live: the counter counts, the number input drives
 * the total, the form validates, the second sign-in card wears a skin.
 */
import { html, key, nothing } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { env } from "@bootstrapp/light/env";
import { matchesBreakpoint } from "@bootstrapp/light/components/utils/breakpoints.js";
import { browsableCategories } from "@bootstrapp/showcase/lib/categories.js";
import { applySkin, clearSkin } from "@bootstrapp/showcase/lib/skins.js";
import { COMPONENTS_PATH, GITHUB_URL, NPM_URL, README_URL } from "../lib/paths.js";
import { FACTS, FORM_FIELDS, LIST_ITEMS, PAIRS, PRICE, PRINCIPLES, SNIPPETS, TAGLINE, TERMINAL, THEME_SKIN } from "../lib/home-content.js";
import { defineDemos } from "../lib/home-demos.js";

/** @import { Prop } from "../types.ts" */

const TABS = [{ value: "code", label: "Code" }, { value: "result", label: "Result" }];
const INSTALL = "npm i @bootstrapp/light";
const FOOTER = [
  { title: "Site", links: [{ label: "Components", href: COMPONENTS_PATH }, { label: "Theming", href: "/theming" }, { label: "Skins", href: "/skins" }] },
  { title: "Source", links: [{ label: "GitHub", href: GITHUB_URL }, { label: "npm", href: NPM_URL }, { label: "README", href: README_URL }] },
];

const envLabel = () => `${env.width}×${env.height} · ${env.breakpoint} · ${env.os} · ${env.dark ? "dark" : "light"}`;

export default defineComponent({
  tag: "docs-home",
  style: true,
  props: {
    phone: false,
    tabs: /** @type {Prop<Record<string, string>>} */ (T.object({ defaultValue: () => ({}) })),
    qty: 2,
    envLabel: "",
    saved: "",
  },

  connected() {
    defineDemos();
    this._measure();
    this.$own(env.subscribe(() => this._measure()));
    this.$own(() => clearSkin(THEME_SKIN));
    return applySkin(THEME_SKIN);
  },

  _measure() {
    this.phone = !matchesBreakpoint("md");
    this.envLabel = envLabel();
  },

  /** @param {{ key: string, title: string }} pair @param {number} total */
  _title(pair, total) {
    return pair.key === "form" ? `${total} components` : pair.title;
  },

  /** @param {Event} event @param {string} id */
  _jump(event, id) {
    event.preventDefault();
    this.$(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  /** @param {(typeof PAIRS)[number]} pair @param {number} total */
  _pair(pair, total) {
    const shown = this.tabs[pair.key] ?? "result";
    const code = html`<lc-code-block class="home-code" language=${pair.language} .code=${SNIPPETS[pair.key]} line-numbers wrap></lc-code-block>`;
    const result = html`<div class="home-stage">${this._demo(pair.key)}</div>`;
    return html`
      <section id=${pair.key} class="home-pair">
        <div class="home-section-head"><h2>${this._title(pair, total)}</h2><p>${pair.lede}</p></div>
        ${this.phone
          ? html`
              <lc-segmented class="home-tabs" size="sm" .options=${TABS} value=${shown} @change=${(/** @type {CustomEvent} */ e) => { this.tabs = { ...this.tabs, [pair.key]: e.detail.value }; }}></lc-segmented>
              ${shown === "code" ? code : result}
            `
          : html`<div class="home-pair-grid">${code}${result}</div>`}
      </section>
    `;
  },

  /** @param {string} id */
  _demo(id) {
    switch (id) {
      case "counter":
        return html`<my-counter></my-counter><span class="home-note">&lt;my-counter&gt;, counting your clicks</span>`;
      case "templates":
        return html`
          <lc-card padding="md" class="home-list">
            <ul>${LIST_ITEMS.map((item) => key(item, html`<li>${item}</li>`))}</ul>
            <span class="home-note">${LIST_ITEMS.length} items · the footer slotted by the page</span>
          </lc-card>
        `;
      case "signals":
        return html`
          <lc-card padding="md" class="home-signals">
            <lc-number-input .value=${this.qty} min="0" max="99" @change=${(/** @type {CustomEvent} */ e) => { this.qty = Number(e.detail.value); }}></lc-number-input>
            <span class="home-note">× ${PRICE.toFixed(2)} =</span>
            <b>${(this.qty * PRICE).toFixed(2)}</b>
          </lc-card>
        `;
      case "attributes":
        return html`<my-counter></my-counter><my-counter label="Taps" count="7" big></my-counter><span class="home-note">the second one read its three attributes</span>`;
      case "env":
        return html`
          <lc-card padding="md" class="home-env">
            <code class="home-mono">${this.envLabel}</code>
            <span class="home-note">env, updated on resize</span>
            <lc-link href=${COMPONENTS_PATH} class="home-env-link">Components <lc-icon name="chevron-right" size="14"></lc-icon></lc-link>
            <span class="home-note">lc-link, routed by the site's router</span>
          </lc-card>
        `;
      case "theme":
        return html`
          <div class="home-skins">
            ${["default", THEME_SKIN].map((skin) => html`
              <div class="home-skin" data-lc-skin=${skin === "default" ? nothing : skin}>
                ${this._signIn()}
                <span class="home-note">${skin === "default" ? "applyTheme" : `applyScopedTheme, ${skin}`}</span>
              </div>
            `)}
          </div>
        `;
      case "form":
        return html`
          <lc-card padding="md" class="home-form">
            <lc-form .fields=${FORM_FIELDS} layout="stacked" @form-submit=${(/** @type {CustomEvent} */ e) => { this.saved = `Saved ${e.detail.email} on ${e.detail.plan}`; }}></lc-form>
            <lc-button primary @click=${() => this._save()}>Save</lc-button>
            ${this.saved ? html`<span class="home-note">${this.saved}</span>` : nothing}
          </lc-card>
        `;
      case "test":
        return html`
          <div class="home-terminal">
            ${TERMINAL.map((line) => html`
              <div class=${line.bold ? "home-terminal-bold" : ""}>
                ${line.prompt ? html`<span class="home-terminal-dim">${line.prompt}</span> ` : nothing}${line.mark ? html`<span class="home-terminal-ok">${line.mark}</span> ` : nothing}${line.text}${line.muted ? html` <span class="home-terminal-dim">${line.muted}</span>` : nothing}${line.file ? html` ${line.file}` : nothing}
              </div>
            `)}
          </div>
        `;
      default:
        return nothing;
    }
  },

  _save() {
    const form = /** @type {(HTMLElement & { submit(): void }) | null} */ (this.$("lc-form"));
    form?.submit();
  },

  _signIn() {
    return html`
      <lc-card padding="md" class="home-signin">
        <b>Sign in</b>
        <lc-input type="email" placeholder="you@example.com"></lc-input>
        <lc-button primary>Sign in</lc-button>
      </lc-card>
    `;
  },

  render() {
    const total = browsableCategories($APP.manifest).reduce((sum, category) => sum + category.components.length, 0);
    return html`
      <section class="home-hero">
        <h1 class="home-title">Light<span class="home-tagline">${TAGLINE}</span></h1>
        <p class="home-lede">Everything React does, on custom elements and event listeners instead of a virtual DOM. Signals, a theme engine and ${total} components come in the box.</p>
        <div class="home-actions">
          <lc-button primary href=${COMPONENTS_PATH}>Components</lc-button>
          <lc-button href=${README_URL} external><lc-icon name="github" size="15"></lc-icon>README</lc-button>
          <code class="home-install"><span class="home-terminal-dim">$</span> ${INSTALL}<lc-clipboard icon-only size="xs" text=${INSTALL}></lc-clipboard></code>
        </div>
      </section>
      <section class="home-facts">
        ${FACTS.map((fact) => html`<div class="home-fact"><div class="home-fact-head"><b>${fact.value}</b><span class="home-eyebrow">${fact.label}</span></div><p>${fact.line}</p></div>`)}
      </section>
      <section class="home-principles">
        ${PRINCIPLES.map((principle) => html`<lc-card padding="lg" class="home-principle"><span class="home-eyebrow">${principle.eyebrow}</span><h2>${principle.title}</h2><p>${principle.text}</p></lc-card>`)}
      </section>
      <section class="home-index">
        <div class="home-section-head"><span class="home-eyebrow">The package</span><h2>What is in it</h2></div>
        <div class="home-index-grid">
          ${PAIRS.map((pair) => html`
            <a class="home-index-card" href=${`#${pair.key}`} @click=${(/** @type {Event} */ e) => this._jump(e, pair.key)}>
              <span class="home-index-icon"><lc-icon name=${pair.icon} size="18"></lc-icon></span>
              <b>${this._title(pair, total)}</b>
              <p>${pair.card}</p>
            </a>
          `)}
        </div>
      </section>
      ${PAIRS.map((pair) => this._pair(pair, total))}
      <section class="home-cta">
        <div class="home-cta-text"><h2>See all ${total}.</h2><p>The catalogue draws each component from its demo file, with its props, its examples and a playground, in any skin.</p></div>
        <div class="home-actions"><lc-button href=${COMPONENTS_PATH} class="home-cta-solid">Components</lc-button><lc-button href="/theming" class="home-cta-outline">Theming</lc-button></div>
      </section>
      <footer class="home-footer">
        <div class="home-footer-brand"><span class="home-brand"><span class="home-mark"><lc-icon name="box" size="14"></lc-icon></span><b>Light</b></span><p>${TAGLINE}</p></div>
        ${FOOTER.map((column) => html`
          <div class="home-footer-col">
            <span class="home-eyebrow">${column.title}</span>
            ${column.links.map((link) => html`<lc-link href=${link.href} ?external=${link.href.startsWith("http")}>${link.label}</lc-link>`)}
          </div>
        `)}
        <span class="home-footer-note">Alan Meira</span>
      </footer>
    `;
  },
});
