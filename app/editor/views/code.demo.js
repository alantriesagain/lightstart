import { html } from "/app/light/html/index.js";

export default {
  description: "A code editor with syntax highlighting, line numbers and a readonly mode, from @bootstrapp/editor.",
  preview: () => html`
    <editor-code language="javascript" .value=${"const total = items.length;\nconst label = String(total);\nexport default label;"}></editor-code>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "A javascript editor",
      render: () => html`
        <editor-code language="javascript" value="const a = 1;"></editor-code>
      `,
    },
    {
      title: "Read-only sample without line numbers",
      render: () => html`
        <editor-code language="html" value="&lt;p&gt;hello&lt;/p&gt;" readonly line-numbers="false"></editor-code>
      `,
    },
  ],
};
