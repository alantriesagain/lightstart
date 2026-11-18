import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View, { defineComponent } from "@lightstart/light";
import catalogue from "../controllers/catalogue.js";
import "@lightstart/showcase/views/catalogue.js";

const view = defineComponent({
  tag: "docs-overview",
  props: {
    search: T.string({ sync: "catalogue", defaultValue: "" }),
    skin: T.string({ sync: "catalogue", defaultValue: "" }),
  },
  render() {
    return html`
      <showcase-catalogue
        .search=${this.search}
        skin=${this.skin}
        @open=${(/** @type {CustomEvent} */ e) => catalogue.open(e.detail.category, e.detail.name)}
      ></showcase-catalogue>
    `;
  },
});

View.define(view);

export default view;
