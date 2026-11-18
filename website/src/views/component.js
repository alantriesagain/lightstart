/**
 * One component's page: the package's `showcase-component-doc` between the site's
 * breadcrumbs and its pager, with the outline handed to the shell's aside.
 */
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent } from "@lightstart/light";
import catalogue from "../controllers/catalogue.js";
import { browsableCategories, categoryById, componentTags, humanize } from "@lightstart/showcase";
import "@lightstart/showcase/views/component-doc.js";
import { categoryPath, componentPath, COMPONENTS_PATH, neighbours } from "../../lib/paths.js";

/** @import { ComponentRef } from "../../lib/paths.js" */
/** @import { TocItem } from "@lightstart/components/types.ts" */

/** @param {ComponentRef | null} ref */
const pagerLink = (ref) => (ref ? { label: humanize(ref.name), href: componentPath(ref.category, ref.name), hint: humanize(ref.category) } : null);

const view = defineComponent({
  tag: "docs-component",
  props: {
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
    category: T.string(),
    name: T.string(),
  },

  disconnected() {
    catalogue.toc = [];
  },

  /** @param {CustomEvent<{ examples: string[] }>} e */
  _loaded(e) {
    /** @type {TocItem[]} */
    const items = [
      { id: "examples", label: "Examples" },
      ...e.detail.examples.map((title, index) => ({ id: `example-${index}`, label: title, level: 2 })),
      { id: "playground", label: "Playground" },
      { id: "api", label: "API" },
    ];
    catalogue.toc = items;
  },

  render() {
    const category = categoryById(this.category);
    const { previous, next } = neighbours(browsableCategories(componentTags()), this.category, this.name);
    return html`
      <div class="docs-page">
        <lc-breadcrumbs
          size="sm"
          .items=${[
            { text: "Components", href: COMPONENTS_PATH, isLast: false },
            { text: category?.label ?? humanize(this.category), href: categoryPath(this.category), isLast: false },
            { text: humanize(this.name), href: null, isLast: true },
          ]}
        ></lc-breadcrumbs>
        <showcase-component-doc
          category=${this.category}
          name=${this.name}
          skin=${this.skin}
          @open=${(/** @type {CustomEvent} */ e) => catalogue.open(e.detail.category, e.detail.name)}
          @loaded=${this._loaded}
        ></showcase-component-doc>
        <lc-pagination class="docs-pager" variant="pager" .previousLink=${pagerLink(previous)} .nextLink=${pagerLink(next)}></lc-pagination>
      </div>
    `;
  },
});

View.define(view);

export default view;
