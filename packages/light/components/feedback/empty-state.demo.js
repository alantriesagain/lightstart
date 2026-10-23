import { html } from "@bootstrapp/light/html";

export default {
  description: "What to show when there is nothing yet, and what to do about it.",
  preview: () => html`
    <lc-empty-state size="sm" icon="inbox" title="Inbox clear"></lc-empty-state>
  `,
  examples: [
    {
      title: "Nothing yet",
      render: () => html`
        <lc-empty-state
          icon="calendar-x"
          title="No events this month"
          description="Events you save will show up here."
        ></lc-empty-state>
      `,
    },
    {
      title: "With an action",
      render: () => html`
        <lc-empty-state icon="inbox" title="Your inbox is clear" description="Nothing needs you right now.">
          <lc-button primary size="sm">Browse events</lc-button>
        </lc-empty-state>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex direction="column" gap="lg">
          <lc-empty-state size="sm" icon="search" title="No matches"></lc-empty-state>
          <lc-empty-state size="md" icon="search" title="No matches"></lc-empty-state>
        </lc-flex>
      `,
    },
  ],
};
