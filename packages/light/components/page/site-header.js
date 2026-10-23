import { html, unsafeHTML } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, SiteHeaderBrand, SiteHeaderLink, SiteHeaderAction } from "../types.ts" */

export default defineComponent({
  tag: "lc-site-header",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary"],
    text: ["caption"],
    font: ["medium", "bold"],
    radius: ["full"],
    shadow: ["nav", "sm"],
  },
  props: {
    brand: /** @type {Prop<SiteHeaderBrand>} */ (T.object({
      attribute: false,
      defaultValue: {},
      props: {
        name: T.string(),
        logo: T.string(),
        href: T.string(),
      },
    })),
    links: /** @type {Prop<SiteHeaderLink[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        label: T.string(),
        href: T.string(),
      },
    })),
    actions: /** @type {Prop<SiteHeaderAction[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        label: T.string(),
        href: T.string(),
        variant: T.string({ enum: ["primary", "secondary"] }),
      },
    })),
  },
  render() {
    const brand = this.brand;
    const links = this.links;
    const actions = this.actions;

    return html`
      <nav
        class="site-header-nav fixed top-6 left-0 right-0 z-50 mx-auto p-1.5 hidden md:flex items-center w-max"
      >
        <a
          href=${brand.href || "#"}
          class="site-header-brand flex items-center justify-center mr-6 ml-1 cursor-pointer"
          aria-label=${brand.name || ""}
        >
          ${brand.logo ? unsafeHTML(brand.logo) : ""}
        </a>
        <ul class="site-header-links flex items-center gap-7">
          ${links.map(
            (link) => html`
              <li>
                <a href=${link.href}>${link.label}</a>
              </li>
            `,
          )}
        </ul>
        <div class="site-header-divider flex items-center gap-4 ml-6 pl-6">
          ${actions.map((action) =>
            action.variant === "primary"
              ? html`<a
                  href=${action.href}
                  class="site-header-action-primary px-6 py-2.5"
                  >${action.label}</a
                >`
              : html`<a
                  href=${action.href}
                  class="site-header-action-secondary px-2"
                  >${action.label}</a
                >`,
          )}
        </div>
      </nav>
    `;
  },
});
