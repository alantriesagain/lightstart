import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-about-section",
  style: true,
  themeTokens: {
    color: ["accent", "surface", "text-primary", "text-secondary"],
    text: ["eyebrow", "section", "subhead", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["xs", "md", "lg", "xl", "2xl", "3xl", "4xl"],
    radius: ["full"],
  },
  props: {
    variant: T.string({
      defaultValue: "prose",
      enum: ["prose", "split"],
    }),
    eyebrow: "",
    headline: "",
    subheadline: "",
    body: "",
    sectionId: "",
  },
  render() {
    const variantClass =
      this.variant === "split"
        ? "about-section-split"
        : "about-section-prose";

    return html`
      <section
        id=${this.sectionId || ""}
        class="about-section ${variantClass}"
      >
        <div class="about-section-inner">
          <div class="about-section-head">
            ${this.eyebrow
              ? html`<span class="about-eyebrow">${this.eyebrow}</span>`
              : ""}
            ${this.headline
              ? html`<h2 class="about-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="about-subheadline">${this.subheadline}</p>`
              : ""}
          </div>
          ${this.body
            ? html`<div class="about-body">
                <lc-markdown .content=${this.body}></lc-markdown>
              </div>`
            : ""}
        </div>
      </section>
    `;
  },
});
