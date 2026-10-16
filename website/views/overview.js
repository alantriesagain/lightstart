import { html } from "@bootstrapp/light/html";
import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
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
        @open=${(/** @type {CustomEvent} */ e) => $APP.catalogue.open(e.detail.category, e.detail.name)}
      ></showcase-catalogue>
    `;
  },
});
