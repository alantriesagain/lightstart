import { html } from "@bootstrapp/light/html";

export default {
  description: "A surface that groups things, with a header, a body and a footer it pads itself.",
  slot: () => html`
    <lc-text level="4" size="base" slot="header">Card Title</lc-text>
    <p>Card content goes here. This is a sample paragraph inside a card component.</p>
    <div slot="footer">
      <lc-button size="sm">Action</lc-button>
    </div>
  `,
  preview: () => html`
    <lc-card padding="sm" style="width: 180px">
      <lc-text slot="header" weight="semibold" size="sm">Weekly report</lc-text>
      <lc-text size="xs" muted>12 tasks closed, 3 open.</lc-text>
    </lc-card>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-card>
          <h3 slot="header">Card Title</h3>
          <p>Card content goes here...</p>
        </lc-card>
      `,
    },
    {
      title: "Heading, icon and actions",
      description: "heading and icon draw a header row; the actions slot sits at its right end.",
      render: () => html`
        <lc-card heading="Top posts" icon="trending-up" style="width:320px">
          <lc-button slot="actions" size="sm" ghost>See all</lc-button>
          <p>Three posts passed 10K reach this week.</p>
        </lc-card>
      `,
    },
    {
      title: "Footer",
      render: () => html`
        <lc-card>
          <header slot="header"><h3 class="flex">User Profile</h3></header>
          <article>
            <p>John Doe</p>
            <p>Software Engineer</p>
          </article>
          <footer slot="footer">
            <lc-button primary>Edit</lc-button>
            <lc-button>Cancel</lc-button>
          </footer>
        </lc-card>
      `,
    },
    {
      title: "Variants",
      render: () => html`
        <div class="flex flex-row gap-2">
         <lc-card variant="default">Default Card</lc-card>
         <lc-card variant="elevated">Elevated Card</lc-card>
        </div>
      `,
    },
    {
      title: "Padding options",
      render: () => html`
        <div class="flex flex-row gap-2">
         <lc-card padding="none">No Padding</lc-card>
         <lc-card padding="sm">Small Padding</lc-card>
         <lc-card padding="md">Medium Padding</lc-card>
         <lc-card padding="lg">Large Padding</lc-card>
        </div>
      `,
    },
  ],
};
