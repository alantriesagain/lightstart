import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

/**
 * About section
 *
 * @component
 * @category page
 * @tag lc-about-section
 *
 * A page band for the long explanation, in prose or in columns. The body renders through
 * `<lc-markdown>`.
 *
 * @prop {string} variant - `prose` or `split`.
 * @prop {string} eyebrow - The small line above the headline.
 * @prop {string} headline - The section heading.
 * @prop {string} subheadline - The line under the heading.
 * @prop {string} body - Markdown rendered under the head.
 * @prop {string} sectionId - The section's id.
 * @prop {boolean} unsafeHtml - Render the body's raw HTML rather than showing it as text.
 */
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
    unsafeHtml: T.boolean({ attribute: false, defaultValue: false }),
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
                <lc-markdown .content=${this.body} .unsafeHtml=${this.unsafeHtml}></lc-markdown>
              </div>`
            : ""}
        </div>
      </section>
    `;
  },
});
