import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, Testimonial } from "../types.ts" */

export default defineComponent({
  tag: "lc-testimonial-section",
  style: true,
  themeTokens: {
    color: ["surface", "surface-inverse", "text-primary", "text-secondary", "text-muted", "warning"],
    text: ["eyebrow", "section", "subhead", "body"],
    font: ["bold", "black", "medium"],
    spacing: ["lg", "xl", "2xl"],
    radius: ["full", "hero"],
    shadow: ["card", "card-hover"],
  },
  props: {
    eyebrow: "",
    headline: "",
    subheadline: "",
    testimonials: /** @type {Prop<Testimonial[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        rating: T.number(),
        quote: T.string(),
        avatar: T.string(),
        author: T.string(),
        role: T.string(),
      },
    })),
    sectionId: "",
  },
  render() {
    const testimonials = this.testimonials;

    return html`
      <section id=${this.sectionId || ""} class="py-28 px-6">
        <div class="max-w-6xl mx-auto">
          <div class="text-center mb-16">
            ${this.eyebrow
              ? html`<span class="testimonial-eyebrow">${this.eyebrow}</span>`
              : ""}
            ${this.headline
              ? html`<h2 class="testimonial-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="testimonial-subheadline">
                  ${this.subheadline}
                </p>`
              : ""}
          </div>
          <div class="grid md:grid-cols-3 gap-6">
            ${testimonials.map(
              (t) => html`
                <div class="testimonial-card">
                  <div class="flex items-center gap-0.5 mb-5">
                    ${Array.from({ length: t.rating || 5 }).map(
                      () => html`
                        <lc-icon
                          name="star"
                          class="testimonial-star w-4 h-4"
                        ></lc-icon>
                      `,
                    )}
                  </div>
                  <p class="testimonial-quote">“${t.quote}”</p>
                  <div class="flex items-center gap-3">
                    <img
                      src=${t.avatar || ""}
                      alt=${t.author || ""}
                      class="testimonial-avatar"
                    />
                    <div>
                      <p class="testimonial-author">${t.author}</p>
                      <p class="testimonial-role">${t.role}</p>
                    </div>
                  </div>
                </div>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  },
});
