import { html } from "@lightstart/light/html";

export default {
  description: "Panels one at a time, switched by a row of tabs.",
  slot: () => html`
    <button slot="tab">Tab 1</button>
    <button slot="tab">Tab 2</button>
    <button slot="tab">Tab 3</button>
    <div slot="panel">First tab panel content</div>
    <div slot="panel">Second tab panel content</div>
    <div slot="panel">Third tab panel content</div>
  `,
  preview: () => html`
    <lc-tabs>
      <button slot="tab">Profile</button>
      <button slot="tab">Settings</button>
      <div slot="panel">Profile content</div>
      <div slot="panel">Settings content</div>
    </lc-tabs>
  `,
  examples: [
    {
      title: "One panel per tab",
      render: () => html`
        <lc-tabs activeTab=2>
          <button slot="tab">Profile</button>
          <button slot="tab">Settings</button>
          <button slot="tab">Account</button>

          <div slot="panel">Profile content...</div>
          <div slot="panel">Settings content...</div>
          <div slot="panel">Account content...</div>
        </lc-tabs>
      `,
    },
    {
      title: "Variants",
      render: () => html`
        <lc-tabs variant="pills">
          <button slot="tab">Tab 1</button>
          <button slot="tab">Tab 2</button>
          <div slot="panel">Panel 1</div>
          <div slot="panel">Panel 2</div>
        </lc-tabs>
      `,
    },
    {
      title: "Vertical orientation",
      render: () => html`
        <lc-tabs vertical variant="underline">
          <button slot="tab">Navigation</button>
          <button slot="tab">Content</button>
          <div slot="panel">Nav content</div>
          <div slot="panel">Main content</div>
        </lc-tabs>
      `,
    },
    {
      title: "Closable and reorderable",
      description: "Delete or a middle-click closes a `closable` tab, and dragging one emits `tab-reorder`. A drawn close button comes with `tabs` data.",
      render: () => html`
        <lc-tabs reorderable>
          <button slot="tab" value="inbox" closable>Inbox</button>
          <button slot="tab" value="drafts" closable>Drafts</button>
          <button slot="tab" value="sent">Sent</button>
          <div slot="panel">Inbox</div>
          <div slot="panel">Drafts</div>
          <div slot="panel">Sent</div>
        </lc-tabs>
      `,
    },
    {
      title: "Tabs from data, with drawn close buttons",
      render: () => html`
        <lc-tabs .tabs=${[
          { id: "inbox", label: "Inbox", icon: "inbox", badge: "3", closable: true },
          { id: "drafts", label: "Drafts", icon: "file-text" },
        ]}>
          <div slot="panel">Inbox</div>
          <div slot="panel">Drafts</div>
        </lc-tabs>
      `,
    },
  ],
};
