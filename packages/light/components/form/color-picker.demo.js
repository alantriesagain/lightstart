import { html } from "@bootstrapp/light/html";

export default {
  description: "A colour swatch that opens a picker, with the hex value as its form value.",
  preview: () => html`
    <lc-color-picker value="#6366f1cc" alpha allowClear></lc-color-picker>
  `,
  examples: [
    {
      title: "A background with opacity and a way to clear it",
      render: () => html`
        <lc-color-picker value="#1d202180" alpha allowClear></lc-color-picker>
      `,
    },
  ],
};
