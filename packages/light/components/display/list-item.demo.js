import { html } from "@bootstrapp/light/html";

export default {
  description: "One entry in a list, with room for an icon, text and an action.",
  slot: () => "List item",
  preview: () => html`
    <lc-list>
      <lc-list-item><lc-icon name="check"></lc-icon>Venue booked</lc-list-item>
      <lc-list-item><lc-icon name="check"></lc-icon>Speakers confirmed</lc-list-item>
    </lc-list>
  `,
  examples: [
    {
      title: "In a list",
      render: () => html`
        <lc-list>
          <lc-list-item>Plain entry</lc-list-item>
          <lc-list-item><lc-icon name="check"></lc-icon>With an icon</lc-list-item>
        </lc-list>
      `,
    },
  ],
};
