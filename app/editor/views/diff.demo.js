import { html } from "/app/__light-runtime__.js";

export default {
  description: "Two versions side by side or inline, with the changed lines marked.",
  preview: () => html`
    <editor-diff language="javascript" .original=${"const a = 1;\nconst b = 2;\nexport { a };"} .value=${"const a = 1;\nconst b = 3;\nexport { a, b };"} style="height: 200px"></editor-diff>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Two texts side by side",
      render: () => html`
        <editor-diff original="a\\nb\\nc" value="a\\nB\\nc\\nd" language="javascript" style="height: 200px"></editor-diff>
      `,
    },
    {
      title: "Unified, in one editor",
      render: () => html`
        <editor-diff unified original="a\\nb\\nc" value="a\\nB\\nc\\nd" style="height: 200px"></editor-diff>
      `,
    },
  ],
};
