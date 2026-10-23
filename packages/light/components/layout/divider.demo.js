import { html } from "@bootstrapp/light/html";

export default {
  description: "A rule between things, horizontal or vertical, with an optional label.",
  preview: () => html`
    <lc-flex direction="column" gap="sm" style="width: 160px">
      <lc-text size="sm">Sign in with email</lc-text>
      <lc-divider label="or"></lc-divider>
      <lc-text size="sm">Continue with a passkey</lc-text>
    </lc-flex>
  `,
  examples: [
    {
      title: "Between things",
      render: () => html`
        <lc-flex direction="column" gap="md" style="width:320px">
          <lc-text>Above</lc-text>
          <lc-divider></lc-divider>
          <lc-text>Below</lc-text>
        </lc-flex>
      `,
    },
    {
      title: "Labelled",
      render: () => html`
        <div style="width:320px"><lc-divider label="or"></lc-divider></div>
      `,
    },
    {
      title: "Vertical",
      render: () => html`
        <lc-flex align="center" gap="md" style="height:48px">
          <lc-text>Left</lc-text>
          <lc-divider vertical></lc-divider>
          <lc-text>Right</lc-text>
        </lc-flex>
      `,
    },
  ],
};
