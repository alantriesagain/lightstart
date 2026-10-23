import { html } from "@bootstrapp/light/html";

export default {
  description: "Page numbers with previous and next, collapsing in the middle when there are many.",
  preview: () => html`<lc-pagination current="2" total="5" size="sm"></lc-pagination>`,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-pagination current="3" total="10"></lc-pagination>
      `,
    },
    {
      title: "Simple prev/next",
      render: () => html`
        <lc-pagination variant="simple" current="5" total="20"></lc-pagination>
      `,
    },
    {
      title: "Load more",
      render: () => html`
        <lc-pagination variant="loadmore" loadmore-text="Show More Results"></lc-pagination>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-pagination size="sm" current="3" total="7"></lc-pagination>
          <lc-pagination size="md" current="3" total="7"></lc-pagination>
          <lc-pagination size="lg" current="3" total="7"></lc-pagination>
        </div>
      `,
    },
    {
      title: "Many pages with ellipsis",
      render: () => html`
        <lc-pagination current="15" total="50" siblings="2"></lc-pagination>
      `,
    },
    {
      title: "Pager",
      description: "Two named neighbours, the way a guide moves from page to page.",
      render: () => html`
        <lc-pagination
          variant="pager"
          .previousLink=${{ label: "Bar chart", href: "/components/display/bar-chart" }}
          .nextLink=${{ label: "Calendar", href: "/components/display/calendar" }}
        ></lc-pagination>
      `,
    },
  ],
};
