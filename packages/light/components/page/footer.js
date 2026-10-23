import { html, unsafeHTML } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, FooterBrand, FooterColumn, FooterSocial } from "../types.ts" */

export default defineComponent({
  tag: "lc-footer",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse"],
    text: ["body", "caption"],
    font: ["bold", "medium"],
    spacing: ["lg", "xl", "2xl"],
  },
  props: {
    brand: /** @type {Prop<FooterBrand>} */ (T.object({
      attribute: false,
      defaultValue: {},
      props: {
        name: T.string(),
        logo: T.string(),
        href: T.string(),
      },
    })),
    tagline: "",
    columns: /** @type {Prop<FooterColumn[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        title: T.string(),
        links: T.array({
          itemType: {
            label: T.string(),
            href: T.string(),
          },
        }),
      },
    })),
    copyright: "",
    socials: /** @type {Prop<FooterSocial[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        icon: T.string(),
        href: T.string(),
      },
    })),
  },
  render() {
    const brand = this.brand;
    const columns = this.columns;
    const socials = this.socials;

    return html`
      <footer class="footer-root">
        <div class="footer-divider max-w-6xl mx-auto pt-12">
          <div class="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div class="footer-brand flex items-center gap-2.5 mb-4">
                ${brand.logo ? unsafeHTML(brand.logo) : ""}
                ${brand.name || ""}
              </div>
              ${this.tagline
                ? html`<p class="footer-tagline">${this.tagline}</p>`
                : ""}
              ${socials.length > 0
                ? html`<div class="flex items-center gap-3 mt-4">
                    ${socials.map(
                      (social) => html`
                        <a
                          href=${social.href || "#"}
                          class="footer-social"
                          aria-label=${social.icon}
                        >
                          <lc-icon
                            name=${social.icon}
                            class="w-4 h-4"
                          ></lc-icon>
                        </a>
                      `,
                    )}
                  </div>`
                : ""}
            </div>
            ${columns.map(
              (col) => html`
                <div>
                  <h4 class="footer-col-title">${col.title}</h4>
                  <ul class="flex flex-col gap-2.5">
                    ${(col.links || []).map(
                      (link) => html`
                        <li>
                          <a href=${link.href || "#"} class="footer-link"
                            >${link.label}</a
                          >
                        </li>
                      `,
                    )}
                  </ul>
                </div>
              `,
            )}
          </div>
          <div class="footer-copyright footer-divider pt-8 text-center">
            ${this.copyright}
          </div>
        </div>
      </footer>
    `;
  },
});
