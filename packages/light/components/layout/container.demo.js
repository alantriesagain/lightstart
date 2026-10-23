import { html } from "@bootstrapp/light/html";

export default {
  description: "The box every other surface is built on: background, border, radius and padding as one.",
  slot: () => "Anything, on a surface.",
  preview: () => html`
    <lc-container variant="outlined" padding="lg" style="width: 440px">
      <lc-text weight="semibold">A surface</lc-text>
      <lc-text muted>Background, border, radius and padding as one box.</lc-text>
    </lc-container>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Padding",
      render: () => html`
        <lc-flex direction="column" gap="md">
          <lc-container padding="sm">Small padding</lc-container>
          <lc-container padding="md">Medium padding</lc-container>
          <lc-container padding="lg">Large padding</lc-container>
        </lc-flex>
      `,
    },
    {
      title: "Variants",
      render: () => html`
        <lc-flex gap="md" wrap="wrap">
          <lc-container variant="filled" padding="md">Filled</lc-container>
          <lc-container variant="outlined" padding="md">Outlined</lc-container>
        </lc-flex>
      `,
    },
  ],
};
