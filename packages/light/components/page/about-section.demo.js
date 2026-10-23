import { html } from "@bootstrapp/light/html";

const props = {
  "eyebrow": "About",
  "headline": "A framework sized like a library",
  "subheadline": "Bootstrapp bundles components, data, routing and caching without the framework tax.",
  "body": "Most modern frameworks ship megabytes of code for features you may never use. Bootstrapp takes the opposite bet: a small set of primitives that compose into real applications.\n\n**Light DOM components.** No shadow DOM, no template wars, just web components that play well with CSS.\n\n**Reactive data.** A data layer with hooks, sync and offline caching that reads like an ORM you already know.",
  "variant": "prose",
};

export default {
  description: "A page band for the long explanation, in prose or in columns.",
  preview: () => html`
    <lc-about-section eyebrow="About" headline="A framework sized like a library" body="A small set of primitives that compose into real applications."></lc-about-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-about-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .body=${props.body}
        .variant=${props.variant}
        ></lc-about-section>
      `,
    },
  ],
};
