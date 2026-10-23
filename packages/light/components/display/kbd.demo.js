import { html } from "@bootstrapp/light/html";

export default {
  description: "A key as the reader would press it; a combination is siblings.",
  slot: () => "K",
  preview: () => html`
    <lc-flex gap="xs" align="center">
      <lc-kbd>⌘</lc-kbd><lc-kbd>K</lc-kbd>
    </lc-flex>
  `,
  examples: [
    {
      title: "One key",
      render: () => html`<lc-kbd>Esc</lc-kbd>`,
    },
    {
      title: "A combination",
      render: () => html`<lc-kbd>⌘</lc-kbd><lc-kbd>K</lc-kbd>`,
    },
    {
      title: "In a sentence",
      render: () => html`<p>Press <lc-kbd>↑</lc-kbd> <lc-kbd>↓</lc-kbd> to move and <lc-kbd>↵</lc-kbd> to open.</p>`,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex gap="sm" align="center">
          <lc-kbd size="xs">xs</lc-kbd>
          <lc-kbd size="sm">sm</lc-kbd>
          <lc-kbd size="md">md</lc-kbd>
        </lc-flex>
      `,
    },
  ],
};
