import { html } from "@bootstrapp/light/html";

export default {
  description: "A vertical set of items with consistent spacing and dividers.",
  slot: () => html`
    <lc-list-item>First item</lc-list-item>
    <lc-list-item>Second item</lc-list-item>
    <lc-list-item>Third item</lc-list-item>
  `,
  preview: () => html`
    <lc-list>
      <lc-list-item>Opening remarks</lc-list-item>
      <lc-list-item>Lightning talks</lc-list-item>
      <lc-list-item>Open floor</lc-list-item>
    </lc-list>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-list>
          <lc-list-item>Opening remarks</lc-list-item>
          <lc-list-item>Lightning talks</lc-list-item>
          <lc-list-item>Open floor</lc-list-item>
        </lc-list>
      `,
    },
    {
      title: "Spacing",
      render: () => html`
        <lc-flex gap="xl" align="start">
          <lc-list spacing="sm"><lc-list-item>Tight</lc-list-item><lc-list-item>Tight</lc-list-item></lc-list>
          <lc-list spacing="lg"><lc-list-item>Loose</lc-list-item><lc-list-item>Loose</lc-list-item></lc-list>
        </lc-flex>
      `,
    },
  ],
};
