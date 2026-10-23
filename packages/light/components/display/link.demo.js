import { html } from "@bootstrapp/light/html";

export default {
  description: "An anchor that knows the router, so an internal link is a navigation and not a reload.",
  slot: () => "Link text",
  preview: () => html`
    <lc-flex gap="md" align="center">
      <lc-link href="#" icon="arrow-left">Back</lc-link>
      <lc-link href="https://bootstrapp.ai" external>Docs</lc-link>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-flex gap="md" align="center">
          <lc-link href="#">Internal link</lc-link>
          <lc-link href="https://bootstrapp.ai" external>External link</lc-link>
          <lc-link href="#" disabled>Disabled</lc-link>
        </lc-flex>
      `,
    },
    {
      title: "With an icon",
      render: () => html`
        <lc-flex gap="md" align="center">
          <lc-link href="#" icon="arrow-left">Back</lc-link>
          <lc-link href="#" icon="settings" hide-label tooltip="Settings"></lc-link>
        </lc-flex>
      `,
    },
  ],
};
