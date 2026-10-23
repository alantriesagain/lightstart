import { html } from "@bootstrapp/light/html";

const week = [{ value: 4 }, { value: 7 }, { value: 5 }, { value: 9 }, { value: 8 }, { value: 12 }, { value: 11 }];

export default {
  description: "A trend line small enough to sit inside a row or a stat.",
  preview: () => html`
    <lc-flex align="center" gap="sm">
      <lc-text weight="bold">1,204</lc-text>
      <lc-sparkline .data=${week} width="100" height="32" variant="success" show-area></lc-sparkline>
    </lc-flex>
  `,
  examples: [
    {
      title: "In a row",
      description: "Small enough to sit beside a number without changing the line height.",
      render: () => html`
        <lc-flex align="center" gap="md">
          <lc-text weight="bold">1,204</lc-text>
          <lc-sparkline .data=${week}></lc-sparkline>
          <lc-text size="xs" muted>7 days</lc-text>
        </lc-flex>
      `,
    },
    {
      title: "Variants",
      render: () => html`
        <lc-flex gap="md" align="center">
          <lc-sparkline .data=${week} variant="primary" show-area></lc-sparkline>
          <lc-sparkline .data=${week} variant="success" show-area></lc-sparkline>
          <lc-sparkline .data=${week} variant="error" show-area></lc-sparkline>
        </lc-flex>
      `,
    },
  ],
};
