import { html } from "@bootstrapp/light/html";

export default {
  description: "One icon from the theme's set, sized in the type scale.",
  preview: () => html`
    <lc-flex gap="md" align="center">
      <lc-icon name="house" size="xl"></lc-icon>
      <lc-icon name="circle-check" color="success" size="xl"></lc-icon>
      <lc-icon name="heart" color="danger" size="xl" solid></lc-icon>
      <lc-icon name="star" size="xl"></lc-icon>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-icon name="house"></lc-icon>
      `,
    },
    {
      title: "All sizes",
      render: () => html`
        * <lc-icon name="star" size="xs"></lc-icon>

        * <lc-icon name="star" size="sm"></lc-icon>

        * <lc-icon name="star" size="md"></lc-icon>

        * <lc-icon name="star" size="lg"></lc-icon>

        * <lc-icon name="star" size="xl"></lc-icon>

        * <lc-icon name="star" size="2xl"></lc-icon>

        * <lc-icon name="star" size="3xl"></lc-icon>

        * <lc-icon name="star" size="4xl"></lc-icon>
      `,
    },
    {
      title: "Semantic colors",
      render: () => html`
        <lc-icon name="circle-check" color="success" size="lg"></lc-icon>
        <lc-icon name="exclamation-circle" color="danger" size="lg"></lc-icon>
        <lc-icon name="info-circle" color="info" size="lg"></lc-icon>
      `,
    },
    {
      title: "Solid style",
      render: () => html`
        * <lc-icon name="heart" size="xl" color="danger"></lc-icon>

        * <lc-icon name="heart" size="xl" color="danger" solid></lc-icon>
      `,
    },
  ],
};
