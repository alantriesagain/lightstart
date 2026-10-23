import { html } from "@bootstrapp/light/html";

export default {
  description: "One node of a tree, with its own children and expanded state.",
  preview: () => html`
    <lc-tree-item label="components" icon="folder" expanded>
      <lc-tree-item label="App.js" icon="file" active modified></lc-tree-item>
    </lc-tree-item>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-tree-item label="File" icon="file"></lc-tree-item>
      `,
    },
    {
      title: "Children",
      render: () => html`
        <lc-tree-item label="Folder" icon="folder" expanded>
          <lc-tree-item label="Nested File" icon="file"></lc-tree-item>
        </lc-tree-item>
      `,
    },
    {
      title: "Emoji icon",
      render: () => html`
        <lc-tree-item label="Trips" icon="🧳"></lc-tree-item>
      `,
    },
    {
      title: "Active and modified",
      render: () => html`
        <lc-tree-item label="App.js" icon="file" active modified></lc-tree-item>
      `,
    },
  ],
};
