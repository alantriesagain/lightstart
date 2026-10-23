import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-cta-section")?.props ?? {};

export default {
  description: "The band that asks for the click.",
  preview: () => html`
    <lc-cta-section headline="Ready to ship?" subheadline="Start a project in one command." .ctas=${[{ label: "Get started", href: "#", variant: "primary" }, { label: "Read the docs", href: "#", variant: "secondary" }]}></lc-cta-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-cta-section
        .variant=${props.variant}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .ctas=${props.ctas}
        ></lc-cta-section>
      `,
    },
  ],
};
