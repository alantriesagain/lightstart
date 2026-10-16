/**
 * One component's page: the package's `showcase-component-doc` between the site's
 * breadcrumbs and its pager, with the outline handed to the shell's aside.
 */
import { html } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { browsableCategories, categoryById, humanize } from "@bootstrapp/showcase/lib/categories.js";
import { categoryPath, componentPath, COMPONENTS_PATH, neighbours } from "../lib/paths.js";

/** @import { ComponentRef } from "../lib/paths.js" */
/** @import { TocItem } from "@bootstrapp/light/components/types.ts" */

/** @param {ComponentRef | null} ref */
const pagerLink = (ref) => (ref ? { label: humanize(ref.name), href: componentPath(ref.category, ref.name), hint: humanize(ref.category) } : null);

export default defineComponent({
  tag: "docs-component",
  props: {
    category: T.string(),
    name: T.string(),
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
  },

  disconnected() {
    $APP.catalogue.toc = [];
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
    $APP.catalogue.toc = items;
  },

  render() {
    const category = categoryById(this.category);
    const { previous, next } = neighbours(browsableCategories(), this.category, this.name);
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
          @open=${(/** @type {CustomEvent} */ e) => $APP.catalogue.open(e.detail.category, e.detail.name)}
          @loaded=${this._loaded}
        ></showcase-component-doc>
        <lc-pagination class="docs-pager" variant="pager" .previousLink=${pagerLink(previous)} .nextLink=${pagerLink(next)}></lc-pagination>
      </div>
    `;
  },
});
