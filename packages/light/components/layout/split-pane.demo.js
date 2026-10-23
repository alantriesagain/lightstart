import { html } from "@bootstrapp/light/html";

export default {
  description: "Two panes with a handle between them that the reader drags.",
  slot: () => html`
    <div slot="primary" style="padding: 16px; background: var(--color-surface-lighter);">Primary pane</div>
    <div slot="secondary" style="padding: 16px;">Secondary pane</div>
  `,
  preview: () => html`
    <lc-split-pane initial-size="30%" style="height: 400px">
      <div slot="primary" class="p-4" style="background: var(--color-surface-lighter)">Files</div>
      <div slot="secondary" class="p-4">Editor</div>
    </lc-split-pane>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Fixed sidebar",
      render: () => html`
        <lc-split-pane initialSize="200px" minSize="200px">
          <div slot="primary">Fixed 200px sidebar</div>
          <div slot="secondary">Main content</div>
        </lc-split-pane>
      `,
    },
    {
      title: "Resizable",
      render: () => html`
        <lc-split-pane initialSize="30%" resizable>
          <div slot="primary">Resizable panel</div>
          <div slot="secondary">Main content</div>
        </lc-split-pane>
      `,
    },
    {
      title: "Constraints",
      render: () => html`
        <lc-split-pane
          initialSize="250px"
          minSize="150px"
          maxSize="400px"
          resizable
          storageKey="editor-sidebar"
        >
          <div slot="primary">Sidebar</div>
          <div slot="secondary">Editor</div>
        </lc-split-pane>
      `,
    },
  ],
};
