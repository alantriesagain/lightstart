import { html } from "@bootstrapp/light/html";

const ROUTES = `import { defineRoutes } from "bootstrapp/router";

export default defineRoutes({
  "/": { name: "home", title: "Home", component: "app-home" },
  "/settings": { name: "settings", title: "Settings", component: "app-settings" },
}, { spa: true });`;

const LONG = Array.from({ length: 14 }, (/** @type {unknown} */ _, i) => `<lc-list-row label="Row ${i + 1}"></lc-list-row>`).join("\n");

export default {
  description: "A snippet coloured by the editor's tokenizer, with a copy control and an optional fold.",
  preview: () => html`<lc-code-block language="javascript" title="app.js" line-numbers .code=${'import { defineRoutes } from "bootstrapp/router";\n\nexport default defineRoutes({ "/": { component: "app-home" } });'}></lc-code-block>`,
  previewWidth: 640,
  examples: [
    {
      title: "Markup",
      render: () => html`<lc-code-block .code=${'<lc-button primary size="lg">Save</lc-button>'}></lc-code-block>`,
    },
    {
      title: "JavaScript with a title and line numbers",
      render: () => html`<lc-code-block language="javascript" title="routes.js" line-numbers .code=${ROUTES}></lc-code-block>`,
    },
    {
      title: "Folded",
      description: "A long snippet shows its first lines until the reader asks for the rest.",
      render: () => html`<lc-code-block fold-at="5" .code=${LONG}></lc-code-block>`,
    },
    {
      title: "Marked lines",
      render: () => html`<lc-code-block language="javascript" line-numbers highlight="4-5" .code=${ROUTES}></lc-code-block>`,
    },
    {
      title: "Wrapped, no copy",
      render: () => html`<lc-code-block wrap .copy=${false} .code=${"<lc-text>A line long enough to need wrapping when the block is narrow, which a snippet with one long attribute value often is.</lc-text>"}></lc-code-block>`,
    },
  ],
};
