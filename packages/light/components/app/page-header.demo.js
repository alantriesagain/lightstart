import { html } from "@bootstrapp/light/html";

const CRUMBS = [{ label: "Workspace", href: "#workspace" }, { label: "Projects" }];

export default {
  description: "The single row at the top of a page: crumbs, a title, the page's controls and its tools.",
  previewWidth: 520,
  preview: () => html`
    <lc-page-header title="Overview" .crumbs=${CRUMBS}>
      <lc-button slot="tools" size="sm" primary>New</lc-button>
    </lc-page-header>
  `,
  examples: [
    {
      title: "Title only",
      render: () => html`<lc-page-header title="Insights" subtitle="Last 30 days"></lc-page-header>`,
    },
    {
      title: "Crumbs, controls and tools",
      description: "The divider appears only when something sits in the tools slot.",
      render: () => html`
        <lc-page-header title="Spring launch" .crumbs=${CRUMBS}>
          <lc-segmented slot="controls" size="sm" .options=${["Week", "Month"]} value="Week"></lc-segmented>
          <lc-button slot="tools" size="sm" ghost icon="share-2"></lc-button>
          <lc-button slot="tools" size="sm" primary>Publish</lc-button>
        </lc-page-header>
      `,
    },
    {
      title: "A custom title",
      render: () => html`
        <lc-page-header>
          <span slot="title">Inbox <lc-badge soft size="sm">12</lc-badge></span>
          <lc-button slot="controls" size="sm" ghost>Mark all read</lc-button>
        </lc-page-header>
      `,
    },
  ],
};
