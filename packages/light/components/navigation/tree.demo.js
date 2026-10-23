import { html } from "@bootstrapp/light/html";

/** @param {CustomEvent<{ expanded: boolean }>} e */
const TOGGLED = (e) => console.log("toggled", e.detail.expanded);
/** @param {CustomEvent<{ label: string }>} e */
const SELECTED = (e) => console.log("selected", e.detail.label);

export default {
  description: "Nested items that expand, for a file tree or a category list.",
  slot: () => html`
    <lc-tree-item label="Root">
      <lc-tree-item label="Child 1"></lc-tree-item>
      <lc-tree-item label="Child 2"></lc-tree-item>
    </lc-tree-item>
  `,
  preview: () => html`
    <lc-tree>
      <lc-tree-item label="src" expanded>
        <lc-tree-item label="Button.js" icon="file" active></lc-tree-item>
        <lc-tree-item label="index.js" icon="file"></lc-tree-item>
      </lc-tree-item>
    </lc-tree>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-tree>
          <lc-tree-item label="Folder 1">
            <lc-tree-item label="File 1.1" icon="file"></lc-tree-item>
            <lc-tree-item label="File 1.2" icon="file"></lc-tree-item>
          </lc-tree-item>
          <lc-tree-item label="Folder 2">
            <lc-tree-item label="Subfolder 2.1">
              <lc-tree-item label="File 2.1.1" icon="file"></lc-tree-item>
            </lc-tree-item>
            <lc-tree-item label="File 2.2" icon="file"></lc-tree-item>
          </lc-tree-item>
        </lc-tree>
      `,
    },
    {
      title: "Expanded folders",
      render: () => html`
        <lc-tree>
          <lc-tree-item label="src" expanded>
            <lc-tree-item label="components" expanded>
              <lc-tree-item label="Button.js" icon="file"></lc-tree-item>
              <lc-tree-item label="Input.js" icon="file"></lc-tree-item>
            </lc-tree-item>
            <lc-tree-item label="index.js" icon="file"></lc-tree-item>
          </lc-tree-item>
        </lc-tree>
      `,
    },
    {
      title: "Active and modified states",
      render: () => html`
        <lc-tree>
          <lc-tree-item label="project" expanded>
            <lc-tree-item label="App.js" icon="file" active modified></lc-tree-item>
            <lc-tree-item label="index.js" icon="file"></lc-tree-item>
            <lc-tree-item label="config.json" icon="file" modified></lc-tree-item>
          </lc-tree-item>
        </lc-tree>
      `,
    },
    {
      title: "File explorer",
      render: () => html`
        <lc-tree>
          <lc-tree-item label="Documents">
            <lc-tree-item label="report.pdf" icon="file"></lc-tree-item>
            <lc-tree-item label="notes.txt" icon="file"></lc-tree-item>
          </lc-tree-item>
          <lc-tree-item label="Pictures">
            <lc-tree-item label="vacation" expanded>
              <lc-tree-item label="beach.jpg" icon="image"></lc-tree-item>
              <lc-tree-item label="sunset.jpg" icon="image"></lc-tree-item>
            </lc-tree-item>
          </lc-tree-item>
          <lc-tree-item label="Downloads">
            <lc-tree-item label="installer.exe" icon="file"></lc-tree-item>
          </lc-tree-item>
        </lc-tree>
      `,
    },
    {
      title: "Keys and events",
      description: "Arrow keys move between visible items, Right opens a folder, Left closes it or climbs; a folder emits toggle, a file emits select.",
      render: () => html`
        <lc-tree>
          <lc-tree-item label="src" expanded @toggle=${TOGGLED}>
            <lc-tree-item label="views" icon="folder" @toggle=${TOGGLED}>
              <lc-tree-item label="home.js" icon="file" @select=${SELECTED}></lc-tree-item>
            </lc-tree-item>
            <lc-tree-item label="routes.js" icon="file" @select=${SELECTED}></lc-tree-item>
          </lc-tree-item>
        </lc-tree>
      `,
    },
  ],
};
