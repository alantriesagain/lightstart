import { html } from "@bootstrapp/light/html";

const ITEMS = [
  { id: "toc-demo-examples", label: "Examples" },
  { id: "toc-demo-basic", label: "Basic", level: 2 },
  { id: "toc-demo-variants", label: "Variants", level: 2 },
  { id: "toc-demo-api", label: "API" },
];

/** @param {string} id @param {string} label */
const section = (id, label) => html`
  <section id=${id} style="min-height: 9rem;">
    <h3>${label}</h3>
    <p>What a reader finds under ${label.toLowerCase()}.</p>
  </section>
`;

export default {
  description: "The page's headings as links, the one on screen marked as the reader scrolls.",
  preview: () => html`<lc-toc
    .items=${[
      { id: "toc-preview-examples", label: "Examples" },
      { id: "toc-preview-basic", label: "Basic", level: 2 },
      { id: "toc-preview-api", label: "API" },
    ]}
    active="toc-preview-basic"
  ></lc-toc>`,
  examples: [
    {
      title: "Beside a page",
      render: () => html`
        <lc-flex gap="xl" align="start">
          <div style="flex: 1; max-height: 14rem; overflow: auto;">
            ${section("toc-demo-examples", "Examples")}
            ${section("toc-demo-basic", "Basic")}
            ${section("toc-demo-variants", "Variants")}
            ${section("toc-demo-api", "API")}
          </div>
          <lc-toc .items=${ITEMS} style="width: 12rem;"></lc-toc>
        </lc-flex>
      `,
    },
    {
      title: "Controlled",
      description: "A page that knows where it is names the active id itself.",
      render: () => html`<lc-toc .items=${ITEMS} active="toc-demo-variants" title="Contents"></lc-toc>`,
    },
  ],
};
