import { html } from "@bootstrapp/light/html";

export default {
  description: "The light and dark toggle, following the system until a reader decides.",
  preview: () => html`
    <lc-flex gap="md" align="center">
      <lc-darkmode></lc-darkmode>
      <lc-darkmode compact></lc-darkmode>
    </lc-flex>
  `,
  examples: [
    {
      title: "The toggle",
      render: () => html`
        <lc-flex gap="md" align="center">
          <lc-darkmode></lc-darkmode>
          <lc-darkmode compact></lc-darkmode>
        </lc-flex>
      `,
    },
    {
      title: "As a nav item",
      render: () => html`
        <lc-darkmode nav-item></lc-darkmode>
      `,
    },
  ],
};
