/**
 * The site around every page: a header with the site's links, the palette, the
 * skin picker and the dark toggle; the component tree in the left column (a
 * drawer on a phone), or the section's pages inside /native; the page; and
 * the page's outline on the right.
 */
import { html, nothing } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { ROUTER_CHANGED } from "bootstrapp/router/events.js";
import presets from "@bootstrapp/light/theme/presets.js";
import { browsableCategories, humanize } from "@bootstrapp/showcase/lib/categories.js";
import { matchesBreakpoint } from "@bootstrapp/light/components/utils/breakpoints.js";
import { componentPath, GITHUB_URL } from "../../lib/paths.js";
import { GROUPS, searchIndex } from "../../lib/search-index.js";
import { inNative, NATIVE_GROUPS, NATIVE_PAGES } from "../../lib/native/pages.js";

/** @import { Prop, SkinOption } from "../../types.ts" */
/** @import { NavTreeGroup, TocItem } from "@bootstrapp/light/components/types.ts" */

const COLLAPSE_AT = 7;
const SKIN_MENU = "docs-skin-menu";

const LINKS = [
  { label: "Components", href: "/components" },
  { label: "Theming", href: "/theming" },
  { label: "Skins", href: "/skins" },
  { label: "Native", href: "/native" },
];

/** @param {string} path */
const categoryOf = (path) => path.split("/")[2] ?? "";

export default defineComponent({
  tag: "template-shell",
  style: true,
  props: {
    component: T.object(),
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
    skins: /** @type {Prop<SkinOption[]>} */ (T.array({ sync: "catalogue", defaultValue: [] })),
    toc: /** @type {Prop<TocItem[]>} */ (T.array({ sync: "catalogue", defaultValue: [] })),
    phone: false,
    landing: false,
    native: false,
    openGroups: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
  },

  connected() {
    this.phone = !matchesBreakpoint("md");
    this.$own($APP.env.subscribe(() => {
      this.phone = !matchesBreakpoint("md");
    }));
    this._follow();
    this.$own($APP.events.on(ROUTER_CHANGED, () => this._follow()));
  },

  _follow() {
    this.landing = $APP.Router.path === "/";
    this.native = inNative($APP.Router.path);
    const category = categoryOf($APP.Router.path);
    if (category && !this.openGroups.includes(category)) this.openGroups = [...this.openGroups, category];
    if (!this.openGroups.length) this.openGroups = [browsableCategories()[0]?.id ?? ""];
  },

  /** @returns {NavTreeGroup[]} */
  _groups() {
    if (this.native)
      return NATIVE_GROUPS.map((group) => {
        const items = NATIVE_PAGES.filter((page) => page.group === group.id).map(({ topic, label, nav, href }) => ({ label: nav ?? label, href, exact: !topic }));
        return { id: `native-${group.id}`, label: group.label, icon: group.id === "native" ? "cpu" : "book-open", count: items.length, items };
      });
    return browsableCategories().map((category) => ({
      id: category.id,
      label: category.label,
      icon: category.icon,
      count: category.components.length,
      items: category.components.map((name) => ({ label: humanize(name), href: componentPath(category.id, name) })),
    }));
  },

  _renderSkinMenu() {
    const current = this.skin || "default";
    return html`
      ${this.skins.map(
        (skin) => html`
          <button type="button" class="lc-dropdown-item shell-skin-row" role="menuitemradio" aria-checked=${String(skin.name === current)} @click=${() => $APP.catalogue.chooseSkin(skin.name)}>
            <span class="shell-skin-swatches">
              <lc-circle solid style=${`background: ${skin.primary}`}></lc-circle>
              <lc-circle solid style=${`background: ${skin.canvas}`}></lc-circle>
            </span>
            <span class="shell-skin-text">
              <b>${skin.label}</b>
              <small>${skin.description}</small>
            </span>
            ${skin.name === current ? html`<lc-icon name="check" size="14"></lc-icon>` : nothing}
          </button>
        `,
      )}
      <p class="shell-skin-note">Applied to the content only. The chrome keeps the project theme.</p>
    `;
  },

  _renderSkinTrigger() {
    const current = this.skins.find((skin) => skin.name === (this.skin || "default"));
    return html`
      <lc-link class="shell-skin" popovertarget=${SKIN_MENU} aria-label=${`Skin: ${current?.label ?? "Default"}`}>
        <lc-circle solid style=${current ? `background: ${current.primary}` : nothing}></lc-circle>
        <span>${current?.label ?? "Default"}</span>
        <lc-icon name="chevron-down" size="14"></lc-icon>
      </lc-link>
    `;
  },

  render() {
    const docs = searchIndex(browsableCategories(), presets);
    return html`
      <lc-app-shell breakpoint="md" aside-breakpoint="xl" nav-width=${this.landing ? "0px" : "var(--docs-nav)"} aside-width=${this.toc.length && !this.landing ? "var(--docs-aside)" : "0px"} header-height="var(--docs-header)">
        <header slot="navbar" class="shell-header">
          <lc-link href="/" class="shell-brand" aria-label="Light home">
            <span class="shell-mark"><lc-icon name="box" size="14"></lc-icon></span>
            <b>Light</b>
          </lc-link>
          <nav class="shell-links" aria-label="Site">
            ${LINKS.map((link) => html`<lc-nav-item href=${link.href} label=${link.label} active-match=${link.href} active-bg size="sm"></lc-nav-item>`)}
          </nav>
          <span class="shell-spacer"></span>
          <lc-command-palette
            class="shell-palette"
            placeholder="Search components"
            .docs=${docs}
            .groups=${GROUPS}
            ?compact=${this.phone}
            @command-select=${(/** @type {CustomEvent} */ e) => $APP.catalogue.select(e.detail)}
          ></lc-command-palette>
          ${this.phone ? nothing : this._renderSkinTrigger()}
          <lc-dropdown id=${SKIN_MENU} bordered rounded shadow position="bottom-right" .content=${() => this._renderSkinMenu()}></lc-dropdown>
          <lc-darkmode compact size="18"></lc-darkmode>
          <lc-link href=${GITHUB_URL} external class="shell-github" aria-label="Light on GitHub"><lc-icon name="github" size="16"></lc-icon></lc-link>
        </header>
        ${this.landing
          ? nothing
          : html`
              <div slot="nav" class="shell-nav">
                ${this.phone ? html`<div class="shell-nav-skin">${this._renderSkinTrigger()}</div>` : nothing}
                <lc-nav-tree .groups=${this._groups()} .open=${this.native ? NATIVE_GROUPS.map((group) => `native-${group.id}`) : this.openGroups} collapse-at=${COLLAPSE_AT} @nav-tree-toggle=${(/** @type {CustomEvent} */ e) => { this.openGroups = e.detail.open ? [...this.openGroups, e.detail.id] : this.openGroups.filter((id) => id !== e.detail.id); }}></lc-nav-tree>
              </div>
            `}
        <div class=${this.landing ? "shell-main shell-main-landing" : "shell-main"}>${this.component}</div>
        ${this.landing || !this.toc.length
          ? nothing
          : html`<aside slot="aside" class="shell-aside"><lc-toc .items=${this.toc} offset="56"></lc-toc></aside>`}
      </lc-app-shell>
    `;
  },
});
