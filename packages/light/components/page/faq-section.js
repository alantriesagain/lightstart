import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/** @import { Prop, FaqItem } from "../types.ts" */

export default defineComponent({
  tag: "lc-faq-section",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary", "text-secondary", "text-muted"],
    text: ["eyebrow", "section", "subhead", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["lg", "xl"],
    radius: ["full", "card"],
    shadow: ["card"],
  },
  props: {
    eyebrow: "",
    headline: "",
    subheadline: "",
    items: /** @type {Prop<FaqItem[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        question: T.string(),
        answer: T.string(),
      },
    })),
    openItems: /** @type {Prop<number[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    sectionId: "",
  },
  /** @param {number} index */
  _toggle(index) {
    const open = this.openItems;
    this.openItems = open.includes(index)
      ? open.filter((i) => i !== index)
      : [...open, index];
  },
  render() {
    const items = this.items;
    const openItems = this.openItems;

    return html`
      <section id=${this.sectionId || ""} class="py-28 px-6">
        <div class="max-w-3xl mx-auto">
          <div class="text-center mb-16">
            ${this.eyebrow
              ? html`<span class="faq-eyebrow">${this.eyebrow}</span>`
              : ""}
            ${this.headline
              ? html`<h2 class="faq-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="faq-subheadline">${this.subheadline}</p>`
              : ""}
          </div>
          <div class="flex flex-col gap-3">
            ${items.map((item, index) => {
              const isOpen = openItems.includes(index);
              return html`
                <div class="faq-item">
                  <button
                    class="faq-toggle"
                    @click=${() => this._toggle(index)}
                  >
                    <span class="faq-question">${item.question}</span>
                    <lc-icon
                      name="chevron-down"
                      class="faq-chevron w-5 h-5 ${isOpen ? "rotate-180" : ""}"
                    ></lc-icon>
                  </button>
                  <div
                    class="faq-answer-wrap ${isOpen
                      ? "max-h-96 pb-5"
                      : "max-h-0"}"
                  >
                    <p class="faq-answer">${item.answer}</p>
                  </div>
                </div>
              `;
            })}
          </div>
        </div>
      </section>
    `;
  },
});
