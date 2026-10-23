import { html } from "@bootstrapp/light/html";

const sections = [
  { type: "lc-hero-section", props: { headline: "Ship the thing", subheadline: "A page assembled from sections." } },
  { type: "lc-cta-section", props: { headline: "Ready?", ctas: [{ label: "Start", href: "#" }] } },
];

export default {
  description: "A page's frame: its max width, its gutters and its vertical rhythm.",
  preview: () => html`<lc-page .sections=${sections}></lc-page>`,
  previewWidth: 960,
  examples: [
    {
      title: "Sections as data",
      description: "A page is a list of sections, which is what the page builder edits.",
      render: () => html`
        <lc-page .sections=${sections}></lc-page>
      `,
    },
  ],
};
