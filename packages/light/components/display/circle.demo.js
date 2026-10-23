import { html } from "@bootstrapp/light/html";

export default {
  description: "A dot, for a legend, a status or a decoration.",
  preview: () => html`
    <lc-flex align="center" gap="sm">
      <lc-circle solid></lc-circle>
      <lc-text size="sm">Online</lc-text>
      <lc-circle></lc-circle>
      <lc-text size="sm" muted>Away</lc-text>
    </lc-flex>
  `,
  examples: [
    {
      title: "Outline and solid",
      render: () => html`
        <lc-flex align="center" gap="sm">
          <lc-circle></lc-circle>
          <lc-circle solid></lc-circle>
          <lc-text size="sm" muted>Unread, then read</lc-text>
        </lc-flex>
      `,
    },
  ],
};
