import { html } from "@bootstrapp/light/html";

export default {
  description: "A titled group of items inside a sidebar.",
  preview: () => html`
    <div style="width: 200px">
      <lc-sidebar-section label="Events" count="3" icon="calendar">
        <lc-nav-item icon="circle" label="Upcoming"></lc-nav-item>
        <lc-nav-item icon="circle" label="Past"></lc-nav-item>
      </lc-sidebar-section>
    </div>
  `,
  examples: [
    {
      title: "A titled group",
      render: () => html`
        <div style="width:240px">
          <lc-sidebar-section label="Events" count="3" icon="calendar">
            <lc-nav-item icon="circle" label="Upcoming"></lc-nav-item>
            <lc-nav-item icon="circle" label="Past"></lc-nav-item>
            <lc-nav-item icon="circle" label="Drafts"></lc-nav-item>
          </lc-sidebar-section>
        </div>
      `,
    },
    {
      title: "Collapsed",
      render: () => html`
        <div style="width:240px">
          <lc-sidebar-section label="Archive" count="12" collapsed>
            <lc-nav-item icon="circle" label="2025"></lc-nav-item>
          </lc-sidebar-section>
        </div>
      `,
    },
    {
      title: "Static",
      description: "A plain label with no chevron, for a group that is always open.",
      render: () => html`
        <div style="width:240px">
          <lc-sidebar-section static label="Workspace" count="2">
            <lc-nav-item icon="house" label="Overview"></lc-nav-item>
            <lc-nav-item icon="settings" label="Settings"></lc-nav-item>
          </lc-sidebar-section>
        </div>
      `,
    },
  ],
};
