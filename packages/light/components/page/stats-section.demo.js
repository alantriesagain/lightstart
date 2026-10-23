import { html } from "@bootstrapp/light/html";

const props = {
  "eyebrow": "By the numbers",
  "headline": "Proof, not promises",
  "subheadline": "Numbers from production apps running on Bootstrapp today.",
  "stats": [
    {
      "value": "30KB",
      "label": "Core runtime, gzipped",
    },
    {
      "value": "117",
      "label": "Components in the library",
    },
    {
      "value": "3",
      "label": "Runtimes on one codebase",
    },
    {
      "value": "0ms",
      "label": "Hydration, because there is none",
    },
  ],
  "variant": "default",
};

export default {
  description: "A row of numbers that make the case.",
  preview: () => html`
    <lc-stats-section headline="Proof, not promises" .stats=${[{ value: "30KB", label: "Core runtime" }, { value: "117", label: "Components" }, { value: "3", label: "Runtimes" }]}></lc-stats-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-stats-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .stats=${props.stats}
        .variant=${props.variant}
        ></lc-stats-section>
      `,
    },
  ],
};
