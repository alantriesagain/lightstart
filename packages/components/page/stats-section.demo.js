import { html } from "@lightstart/light/html";

const props = {
  "eyebrow": "By the numbers",
  "headline": "Proof, not promises",
  "subheadline": "What light brings to a project.",
  "stats": [
    {
      "value": "Web",
      "label": "Light DOM components",
    },
    {
      "value": "Model",
      "label": "Reactive data layer",
    },
    {
      "value": "Router",
      "label": "Client-side routing",
    },
    {
      "value": "Check",
      "label": "A convention checker",
    },
  ],
  "variant": "default",
};

export default {
  description: "A row of numbers that make the case.",
  preview: () => html`
    <lc-stats-section headline="Proof, not promises" .stats=${[{ value: "Web", label: "Light DOM components" }, { value: "Model", label: "Reactive data layer" }, { value: "Router", label: "Client-side routing" }]}></lc-stats-section>
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
