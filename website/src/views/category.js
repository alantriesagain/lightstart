import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent } from "@lightstart/light";
import catalogue from "../controllers/catalogue.js";
import { browsableCategories, categoryById, componentTags } from "@lightstart/showcase";
import "@lightstart/showcase/views/catalogue.js";
import { categoryPath, COMPONENTS_PATH, neighbourCategories } from "../../lib/paths.js";

/** @import { ShowcaseCategoryListing } from "@lightstart/showcase" */

/** @param {ShowcaseCategoryListing | null} category */
const pagerLink = (category) => (category ? { label: category.label, href: categoryPath(category.id) } : null);

const view = defineComponent({
  tag: "docs-category",
  props: {
    search: T.string({ sync: "catalogue", defaultValue: "" }),
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
    category: T.string(),
  },
  render() {
    const category = categoryById(this.category);
    if (!category) return html`<lc-empty-state icon="folder-x" title="No such category" description=${`Nothing is filed under "${this.category}".`}></lc-empty-state>`;
    const { previous, next } = neighbourCategories(browsableCategories(componentTags()), this.category);
    return html`
      <div class="docs-page">
        <lc-breadcrumbs size="sm" .items=${[{ text: "Components", href: COMPONENTS_PATH, isLast: false }, { text: category.label, href: null, isLast: true }]}></lc-breadcrumbs>
        <h1 class="docs-title">${category.label}</h1>
        <p class="docs-lede">${category.description}</p>
        <showcase-catalogue
          category=${this.category}
          .search=${this.search}
          skin=${this.skin}
          @open=${(/** @type {CustomEvent} */ e) => catalogue.open(e.detail.category, e.detail.name)}
        ></showcase-catalogue>
        ${previous || next
          ? html`<lc-pagination class="docs-pager" variant="pager" .previousLink=${pagerLink(previous)} .nextLink=${pagerLink(next)}></lc-pagination>`
          : nothing}
      </div>
    `;
  },
});

View.define(view);

export default view;
