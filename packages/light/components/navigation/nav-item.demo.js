import { html } from "@bootstrapp/light/html";

export default {
  description: "One entry in a navigation: icon, label, badge and its active state.",
  preview: () => html`
    <lc-flex gap="sm">
      <lc-nav-item stacked icon="house" label="Home" active></lc-nav-item>
      <lc-nav-item stacked icon="search" label="Search"></lc-nav-item>
      <lc-nav-item stacked icon="bell" label="Inbox" badge="3"></lc-nav-item>
    </lc-flex>
  `,
  examples: [
    {
      title: "In a row",
      render: () => html`
        <lc-flex gap="sm">
          <lc-nav-item icon="house" label="Home" active></lc-nav-item>
          <lc-nav-item icon="calendar" label="Events"></lc-nav-item>
          <lc-nav-item icon="bell" label="Inbox" badge="3"></lc-nav-item>
        </lc-flex>
      `,
    },
    {
      title: "Stacked, as a bottom bar uses it",
      render: () => html`
        <lc-flex gap="lg">
          <lc-nav-item stacked icon="house" label="Home" active></lc-nav-item>
          <lc-nav-item stacked icon="search" label="Search"></lc-nav-item>
          <lc-nav-item stacked icon="user" label="You"></lc-nav-item>
        </lc-flex>
      `,
    },
    {
      title: "A dot, for something unread that is not worth a number",
      render: () => html`
        <lc-flex gap="lg">
          <lc-nav-item stacked icon="house" label="Home" active></lc-nav-item>
          <lc-nav-item stacked icon="bell" label="Inbox" dot></lc-nav-item>
          <lc-nav-item icon-only icon="user" label="You" dot></lc-nav-item>
        </lc-flex>
      `,
    },
    {
      title: "A count on the icon",
      description: "How many are unread, on the glyph's corner, whether the item shows its label or only its icon.",
      render: () => html`
        <lc-flex gap="lg">
          <lc-nav-item icon-only icon="inbox" label="Inbox" count="3"></lc-nav-item>
          <lc-nav-item stacked icon="inbox" label="Inbox" count="9+"></lc-nav-item>
          <lc-nav-item icon="inbox" label="Inbox" count="12" active active-bg></lc-nav-item>
        </lc-flex>
      `,
    },
    {
      title: "Badge variants",
      description: "primary fills the count with the signal colour; muted leaves it as plain text.",
      render: () => html`
        <div style="width:220px">
          <lc-nav-item icon="inbox" label="Inbox" badge="12" badge-variant="primary"></lc-nav-item>
          <lc-nav-item icon="file-text" label="Drafts" badge="4"></lc-nav-item>
          <lc-nav-item icon="archive" label="Archive" badge="230" badge-variant="muted"></lc-nav-item>
        </div>
      `,
    },
    {
      title: "Icon only",
      render: () => html`
        <lc-nav-item icon-only icon="settings" tooltip="Settings"></lc-nav-item>
      `,
    },
  ],
};
