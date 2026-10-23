import { html } from "@bootstrapp/light/html";

export default {
  description: "A desktop window's own title bar, with its controls.",
  slot: () => html`
    <div slot="left"><lc-icon name="app-window"></lc-icon> App Title</div>
    <div slot="right"><lc-button ghost size="xs"><lc-icon name="x"></lc-icon></lc-button></div>
  `,
  preview: () => html`
    <lc-title-bar title="Document.txt - Editor">
      <div slot="left" style="display: flex; gap: 12px; padding-left: 12px;"><button>File</button><button>Edit</button><button>View</button></div>
    </lc-title-bar>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-title-bar title="My Application"></lc-title-bar>
      `,
    },
    {
      title: "App icon",
      render: () => html`
        <lc-title-bar title="My App">
          <div slot="left" style="display: flex; align-items: center; gap: 8px;">
            <img src="/icon.png" alt="App Icon" width="20" height="20">
            <span style="font-weight: 600;">MyApp</span>
          </div>
        </lc-title-bar>
      `,
    },
    {
      title: "Menu",
      render: () => html`
        <lc-title-bar title="Document.txt - Editor">
          <div slot="left" style="display: flex; gap: 12px; padding-left: 12px;">
            <button>File</button>
            <button>Edit</button>
            <button>View</button>
            <button>Help</button>
          </div>
        </lc-title-bar>
      `,
    },
    {
      title: "Unified, as on macOS",
      render: () => html`
        <lc-title-bar
          title="My Document"
          variant="unified"
        ></lc-title-bar>
      `,
    },
    {
      title: "Custom controls",
      render: () => html`
        <lc-title-bar title="My App">
          <div slot="right">
            <button><lc-icon name="settings"></lc-icon></button>
            <button><lc-icon name="circle-help"></lc-icon></button>
          </div>
        </lc-title-bar>
      `,
    },
    {
      title: "Without controls",
      render: () => html`
        <lc-title-bar
          title="Embedded Window"
          show-controls="false"
        ></lc-title-bar>
      `,
    },
    {
      title: "Non-draggable",
      render: () => html`
        <lc-title-bar
          title="Locked Window"
          draggable="false"
        ></lc-title-bar>
      `,
    },
    {
      title: "With tabs",
      render: () => html`
        <lc-title-bar show-controls>
          <div slot="center" style="display: flex; gap: 4px;">
            <button class="tab active">Home</button>
            <button class="tab">Documents</button>
            <button class="tab">Settings</button>
            <button class="tab-new">+</button>
          </div>
        </lc-title-bar>
      `,
    },
    {
      title: "Hidden variant",
      render: () => html`
        <lc-title-bar variant="hidden"></lc-title-bar>
      `,
    },
  ],
};
