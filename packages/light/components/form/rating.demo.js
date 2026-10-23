import { html } from "@bootstrapp/light/html";

export default {
  description: "A star rating, readable or editable.",
  preview: () => html`
    <lc-rating value="4"></lc-rating>
  `,
  examples: [
    {
      title: "Read and set",
      render: () => html`
        <lc-flex direction="column" gap="sm">
          <lc-rating value="4"></lc-rating>
          <lc-rating value="3" max="10"></lc-rating>
        </lc-flex>
      `,
    },
  ],
};
