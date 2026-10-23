import { html } from "@bootstrapp/light/html";

export default {
  description: "Text that becomes an input when clicked and saves on blur.",
  slot: () => "Click to edit",
  preview: () => html`<lc-editable value="Meetup Rio, September"></lc-editable>`,
  examples: [
    {
      title: "Click to edit",
      render: () => html`
        <lc-editable value="Meetup Rio, September"></lc-editable>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex direction="column" gap="sm">
          <lc-editable size="sm" value="Small"></lc-editable>
          <lc-editable size="md" value="Medium"></lc-editable>
          <lc-editable size="lg" value="Large"></lc-editable>
        </lc-flex>
      `,
    },
  ],
};
