import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-hero-section")?.props ?? {};

export default {
  description: "The top of a landing page: eyebrow, headline, subhead and the actions.",
  preview: () => html`
    <lc-hero-section .eyebrow=${{ badge: "New", label: "Frontend framework", href: "#" }} headline="Build web apps without the bloat" subheadline="Components, data and caching in one small runtime." .ctas=${[{ label: "Get started", href: "#", variant: "primary" }, { label: "View source", href: "#", variant: "secondary" }]}></lc-hero-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-hero-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .ctas=${props.ctas}
        .decorations=${props.decorations}
        ></lc-hero-section>
      `,
    },
  ],
};
