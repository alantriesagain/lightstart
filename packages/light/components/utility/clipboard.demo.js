import { html } from "@bootstrapp/light/html";

export default {
  description: "A button that copies a text and says so for a moment.",
  preview: () => html`
    <lc-flex gap="sm" align="center">
      <code>pnpm add @bootstrapp/light</code>
      <lc-clipboard text="pnpm add @bootstrapp/light" icon-only></lc-clipboard>
    </lc-flex>
  `,
  examples: [
    {
      title: "Copy a command",
      render: () => html`
        <lc-flex gap="sm" align="center">
          <code>pnpm add @bootstrapp/light</code>
          <lc-clipboard text="pnpm add @bootstrapp/light"></lc-clipboard>
        </lc-flex>
      `,
    },
    {
      title: "Icon only",
      description: "The label moves into the tooltip.",
      render: () => html`<lc-clipboard .text=${"<lc-button></lc-button>"} icon-only></lc-clipboard>`,
    },
    {
      title: "Own words",
      render: () => html`<lc-clipboard text="4f3c-91aa" label="Copy id" copied-label="Id copied"></lc-clipboard>`,
    },
  ],
};
