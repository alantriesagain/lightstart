import { html, nothing } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { browsableCategories, categoryById } from "@bootstrapp/showcase/lib/categories.js";
import { categoryPath, COMPONENTS_PATH, neighbourCategories } from "../lib/paths.js";

/** @import { ShowcaseCategoryListing } from "@bootstrapp/showcase/types.ts" */

/** @param {ShowcaseCategoryListing | null} category */
const pagerLink = (category) => (category ? { label: category.label, href: categoryPath(category.id) } : null);

export default defineComponent({
  tag: "docs-category",
  props: {
    category: T.string(),
    search: T.string({ sync: "catalogue", defaultValue: "" }),
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
  },
  render() {
    const category = categoryById(this.category);
    if (!category) return html`<lc-empty-state icon="folder-x" title="No such category" description=${`Nothing is filed under "${this.category}".`}></lc-empty-state>`;
    const { previous, next } = neighbourCategories(browsableCategories($APP.manifest), this.category);
    return html`
      <div class="docs-page">
        <lc-breadcrumbs size="sm" .items=${[{ text: "Components", href: COMPONENTS_PATH, isLast: false }, { text: category.label, href: null, isLast: true }]}></lc-breadcrumbs>
        <h1 class="docs-title">${category.label}</h1>
        <p class="docs-lede">${category.description}</p>
        <showcase-catalogue
          category=${this.category}
          .search=${this.search}
          skin=${this.skin}
          @open=${(/** @type {CustomEvent} */ e) => $APP.catalogue.open(e.detail.category, e.detail.name)}
        ></showcase-catalogue>
        ${previous || next
          ? html`<lc-pagination class="docs-pager" variant="pager" .previousLink=${pagerLink(previous)} .nextLink=${pagerLink(next)}></lc-pagination>`
          : nothing}
      </div>
    `;
  },
});
