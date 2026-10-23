import { html } from "@bootstrapp/light/html";

export default {
  description: "Work in progress, when there is no shape to show.",
  preview: () => html`
    <div class="flex gap-4 items-center">
      <lc-spinner primary></lc-spinner>
      <lc-spinner variant="dots" primary></lc-spinner>
      <lc-spinner variant="bars" primary></lc-spinner>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-spinner></lc-spinner>
      `,
    },
    {
      title: "Variants",
      description: "Different animation styles",
      render: () => html`
        <div class="flex gap-4">
          <lc-spinner variant="circular"></lc-spinner>
          <lc-spinner variant="dots"></lc-spinner>
          <lc-spinner variant="bars"></lc-spinner>
        </div>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <div class="flex gap-4 items-center">
          <lc-spinner size="xs"></lc-spinner>
          <lc-spinner size="sm"></lc-spinner>
          <lc-spinner size="md"></lc-spinner>
          <lc-spinner size="lg"></lc-spinner>
          <lc-spinner size="xl"></lc-spinner>
        </div>
      `,
    },
    {
      title: "Colored",
      render: () => html`
        <lc-spinner primary></lc-spinner>
        <lc-spinner secondary></lc-spinner>
        <lc-spinner success></lc-spinner>
        <lc-spinner danger></lc-spinner>
      `,
    },
    {
      title: "Custom color",
      render: () => html`
        <lc-spinner style="--spinner-color: #ff6b6b;"></lc-spinner>
      `,
    },
  ],
};
