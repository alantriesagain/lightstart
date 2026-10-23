import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, ShowcaseImage, ShowcaseCta } from "../types.ts" */

export default defineComponent({
  tag: "lc-showcase-section",
  style: true,
  themeTokens: {
    color: ["accent", "surface", "surface-inverse", "text-primary", "text-secondary"],
    text: ["eyebrow", "section", "subhead", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["md", "lg", "xl", "3xl", "4xl"],
    radius: ["full", "panel"],
    shadow: ["card"],
  },
  props: {
    align: T.string({
      defaultValue: "left",
      enum: ["left", "right"],
    }),
    eyebrow: "",
    headline: "",
    subheadline: "",
    body: "",
    image: /** @type {Prop<ShowcaseImage>} */ (
      T.object({
        attribute: false,
        defaultValue: {},
        props: {
          src: T.string(),
          alt: T.string(),
        },
      })
    ),
    ctas: /** @type {Prop<ShowcaseCta[]>} */ (
      T.array({
        attribute: false,
        defaultValue: [],
        itemType: {
          label: T.string(),
          href: T.string(),
          variant: T.string({ enum: ["primary", "secondary"] }),
        },
      })
    ),
    sectionId: "",
  },
  render() {
    const image = this.image;
    const ctas = this.ctas;
    const alignClass =
      this.align === "right"
        ? "showcase-section-align-right"
        : "showcase-section-align-left";

    const media = image.src
      ? html`<div class="showcase-media">
          <img src=${image.src} alt=${image.alt || ""} loading="lazy" />
        </div>`
      : html`<div class="showcase-media showcase-media-empty"></div>`;

    const copy = html`
      <div class="showcase-copy">
        ${this.eyebrow
          ? html`<span class="showcase-eyebrow">${this.eyebrow}</span>`
          : ""}
        ${this.headline
          ? html`<h2 class="showcase-headline">${this.headline}</h2>`
          : ""}
        ${this.subheadline
          ? html`<p class="showcase-subheadline">${this.subheadline}</p>`
          : ""}
        ${this.body
          ? html`<div class="showcase-body">
              <lc-markdown .content=${this.body}></lc-markdown>
            </div>`
          : ""}
        ${ctas.length > 0
          ? html`<div class="showcase-ctas">
              ${ctas.map((cta) =>
                cta.variant === "secondary"
                  ? html`<a
                      href=${cta.href || "#"}
                      class="showcase-cta showcase-cta-secondary"
                      >${cta.label}</a
                    >`
                  : html`<a
                      href=${cta.href || "#"}
                      class="showcase-cta showcase-cta-primary"
                      >${cta.label}</a
                    >`,
              )}
            </div>`
          : ""}
      </div>
    `;

    return html`
      <section
        id=${this.sectionId || ""}
        class="showcase-section ${alignClass}"
      >
        <div class="showcase-section-inner">
          ${this.align === "right"
            ? html`${copy}${media}`
            : html`${media}${copy}`}
        </div>
      </section>
    `;
  },
});
