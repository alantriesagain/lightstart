import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-feature-grid")?.props ?? {};

export default {
  description: "Features as a grid of icon, title and line.",
  preview: () => html`
    <lc-feature-grid headline="Why teams choose it" .features=${[{ icon: "zap", title: "Small runtime", description: "Load only what you use." }, { icon: "globe", title: "Offline ready", description: "Caching built in." }, { icon: "shield", title: "Typed data", description: "Validation on every write." }]}></lc-feature-grid>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-feature-grid
        .variant=${props.variant}
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .features=${props.features}
        ></lc-feature-grid>
      `,
    },
  ],
};
