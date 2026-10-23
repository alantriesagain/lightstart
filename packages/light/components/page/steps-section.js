import { html, unsafeHTML } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, StepItem, FooterCta } from "../types.ts" */

/** @param {unknown} value */
const renderRich = (value) =>
  value == null ? "" : typeof value === "string" ? unsafeHTML(value) : value;

export default defineComponent({
  tag: "lc-steps-section",
  style: true,
  themeTokens: {
    color: ["primary", "secondary", "surface", "surface-inverse", "text-primary", "text-secondary", "text-muted"],
    text: ["eyebrow", "section", "subhead", "body", "caption"],
    font: ["bold", "black", "medium"],
    spacing: ["sm", "md", "lg", "xl"],
    radius: ["full", "lg"],
    shadow: ["sm", "lg"],
  },
  props: {
    eyebrow: "",
    eyebrowIcon: "",
    headline: "",
    subheadline: "",
    steps: /** @type {Prop<StepItem[]>} */ (T.array({
      attribute: false,
      defaultValue: [],
      itemType: {
        number: T.string(),
        title: T.string(),
        description: T.string(),
        icon: T.string(),
        iconColor: T.string(),
        iconBgColor: T.string(),
        iconBorderColor: T.string(),
        mockupGradientFrom: T.string(),
        mockupGradientTo: T.string(),
        cta: T.object({
          props: {
            label: T.string(),
            href: T.string(),
          },
        }),
        image: T.string({ fieldType: "file", accept: "image/*" }),
      },
    })),
    stepMockups: /** @type {Prop<unknown[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    footerCta: /** @type {Prop<FooterCta | null>} */ (T.object({
      attribute: false,
      defaultValue: null,
      props: {
        label: T.string(),
        href: T.string(),
        icon: T.string(),
      },
    })),
    sectionId: "",
  },
  render() {
    const steps = this.steps;
    const stepMockups = this.stepMockups;
    const footerCta = this.footerCta;

    return html`
      <section id=${this.sectionId || ""} class="py-28 px-6 overflow-hidden">
        <div class="max-w-6xl mx-auto">
          <div class="text-center mb-20">
            ${this.eyebrow
              ? html`<span class="steps-eyebrow">
                  ${this.eyebrowIcon
                    ? html`<lc-icon
                        name=${this.eyebrowIcon}
                        class="w-3 h-3"
                      ></lc-icon>`
                    : ""}
                  ${this.eyebrow}
                </span>`
              : ""}
            ${this.headline
              ? html`<h2 class="steps-headline">${this.headline}</h2>`
              : ""}
            ${this.subheadline
              ? html`<p class="steps-subheadline">${this.subheadline}</p>`
              : ""}
          </div>
          <div class="flex flex-col gap-24">
            ${steps.map((step, index) => {
              const isReversed = index % 2 === 1;
              const layoutClass = isReversed
                ? "flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16"
                : "flex flex-col lg:flex-row items-center gap-12 lg:gap-16";
              const number = step.number || String(index + 1).padStart(2, "0");
              const iconStyle = [
                step.iconBorderColor
                  ? `border-color: ${step.iconBorderColor};`
                  : "",
                step.iconBgColor
                  ? `background-color: ${step.iconBgColor};`
                  : "",
              ].join(" ");
              const iconInnerStyle = step.iconColor
                ? `color: ${step.iconColor};`
                : "";
              const mockupBgStyle = step.mockupGradientFrom
                ? `background: linear-gradient(to bottom right, ${step.mockupGradientFrom}, ${step.mockupGradientTo || step.mockupGradientFrom});`
                : "";
              return html`
                <div class=${layoutClass}>
                  <div class="flex-1 max-w-[480px]">
                    <div class="flex items-center gap-4 mb-6">
                      <div class="step-icon-box" style=${iconStyle}>
                        <lc-icon
                          name=${step.icon || ""}
                          class="step-icon"
                          style=${iconInnerStyle}
                        ></lc-icon>
                      </div>
                      <div>
                        <span class="step-number">Step ${number}</span>
                        <h3 class="step-title">${step.title}</h3>
                      </div>
                    </div>
                    <p class="step-description">${step.description}</p>
                    ${step.cta
                      ? html`<a
                          href=${step.cta.href || "#"}
                          class="step-cta group"
                        >
                          ${step.cta.label}
                          <lc-icon
                            name="arrow-right"
                            class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                          ></lc-icon>
                        </a>`
                      : ""}
                  </div>
                  <div class="flex-1 max-w-[520px] w-full relative">
                    <div class="step-mockup-glow" style=${mockupBgStyle}></div>
                    <div class="relative">${step.image
                      ? html`<img src=${step.image} alt="" class="w-full rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-dim" loading="lazy" />`
                      : renderRich(stepMockups[index])}</div>
                  </div>
                </div>
              `;
            })}
          </div>
          ${footerCta
            ? html`<div class="flex flex-col items-center mt-16">
                <div class="steps-footer-divider"></div>
                <a href=${footerCta.href || "#"} class="steps-footer-cta">
                  ${footerCta.icon
                    ? html`<lc-icon
                        name=${footerCta.icon}
                        class="w-4 h-4"
                      ></lc-icon>`
                    : ""}
                  ${footerCta.label}
                  <lc-icon
                    name="arrow-up-right"
                    class="w-3.5 h-3.5"
                  ></lc-icon>
                </a>
              </div>`
            : ""}
        </div>
      </section>
    `;
  },
});
