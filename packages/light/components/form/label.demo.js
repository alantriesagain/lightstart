import { html } from "@bootstrapp/light/html";

export default {
  description: "The name of a field, tied to it so a click moves focus.",
  slot: () => "Field Label",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-label for="preview-username" required>Username</lc-label>
      <lc-input id="preview-username" size="sm" placeholder="ada"></lc-input>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-label for="username">Username</lc-label>
        <lc-input id="username"></lc-input>
      `,
    },
    {
      title: "Required",
      render: () => html`
        <lc-label for="email" required>Email</lc-label>
        <lc-input id="email" required></lc-input>
      `,
    },
  ],
};
