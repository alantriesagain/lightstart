import { html } from "@bootstrapp/light/html";

export default {
  description: "Every piece of type in the app: the heading levels, the sizes and the muted variants.",
  slot: () => "The quick brown fox jumps over the lazy dog.",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-text eyebrow>Chapter one</lc-text>
      <lc-text level="3" size="xl">The quick brown fox</lc-text>
      <lc-text size="sm" muted>Jumps over the lazy dog.</lc-text>
    </lc-flex>
  `,
  examples: [
    {
      title: "Heading levels",
      render: () => html`
        <lc-flex direction="column" gap="sm">
          <lc-text level="1" size="3xl">Level one</lc-text>
          <lc-text level="2" size="2xl">Level two</lc-text>
          <lc-text level="3" size="xl">Level three</lc-text>
        </lc-flex>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex direction="column" gap="xs">
          <lc-text size="xs">Extra small</lc-text>
          <lc-text size="sm">Small</lc-text>
          <lc-text size="base">Base</lc-text>
          <lc-text size="lg">Large</lc-text>
          <lc-text size="xl">Extra large</lc-text>
        </lc-flex>
      `,
    },
    {
      title: "Emphasis",
      render: () => html`
        <lc-flex direction="column" gap="xs">
          <lc-text weight="bold">Bold</lc-text>
          <lc-text muted>Muted</lc-text>
          <lc-text mono>Monospace</lc-text>
          <lc-text eyebrow>Eyebrow</lc-text>
          <lc-text color="danger">Danger</lc-text>
        </lc-flex>
      `,
    },
  ],
};
