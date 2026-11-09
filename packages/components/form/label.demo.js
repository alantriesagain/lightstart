import { html } from "@lightstart/light/html";

export default {
  description: "The name of a field. An lc-* control takes a label prop; a plain native field takes for.",
  slot: () => "Field Label",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-input label="Username" size="sm" placeholder="ada" required></lc-input>
    </lc-flex>
  `,
  examples: [
    {
      title: "With a control",
      render: () => html`<lc-input label="Username"></lc-input>`,
    },
    {
      title: "Wrapping a control",
      render: () => html`
        <label>Email <lc-input type="email" required></lc-input></label>
      `,
    },
    {
      title: "A plain native field",
      render: () => html`
        <lc-label for="username">Username</lc-label>
        <input id="username" />
      `,
    },
  ],
};
