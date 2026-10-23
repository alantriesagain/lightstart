import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-steps-section")?.props ?? {};

export default {
  description: "A process as numbered steps.",
  preview: () => html`
    <lc-steps-section eyebrow="How it works" headline="Two steps to shipping" .steps=${[{ icon: "zap", title: "Install", description: "Scaffold a project with one command.", image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='lightsteelblue'/%3E%3Crect x='16' y='16' width='80' height='10' rx='5' fill='white'/%3E%3Crect x='16' y='36' width='128' height='48' rx='6' fill='aliceblue'/%3E%3C/svg%3E" }, { icon: "globe", title: "Deploy", description: "Ship to any static host.", image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='lightsteelblue'/%3E%3Crect x='16' y='16' width='80' height='10' rx='5' fill='white'/%3E%3Crect x='16' y='36' width='128' height='48' rx='6' fill='aliceblue'/%3E%3C/svg%3E" }]}></lc-steps-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-steps-section
        .eyebrow=${props.eyebrow}
        .eyebrowIcon=${props.eyebrowIcon}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .steps=${props.steps}
        .stepMockups=${props.stepMockups}
        .footerCta=${props.footerCta}
        ></lc-steps-section>
      `,
    },
  ],
};
