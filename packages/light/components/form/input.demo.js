import { html } from "@bootstrapp/light/html";

export default {
  description: "A single-line value. Label, icon, validation state and help text come with it.",
  preview: () => html`
    <lc-input label="Email" type="email" placeholder="you@example.com"></lc-input>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-input placeholder="Enter text..."></lc-input>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-input size="xs" placeholder="Extra small"></lc-input>
          <lc-input size="sm" placeholder="Small"></lc-input>
          <lc-input size="md" placeholder="Medium"></lc-input>
          <lc-input size="lg" placeholder="Large"></lc-input>
          <lc-input size="xl" placeholder="Extra large"></lc-input>
        </div>
      `,
    },
    {
      title: "Different types",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-input type="text" placeholder="Text"></lc-input>
          <lc-input type="email" placeholder="Email"></lc-input>
          <lc-input type="tel" placeholder="Phone"></lc-input>
          <lc-input type="url" placeholder="URL"></lc-input>
          <lc-input type="search" placeholder="Search"></lc-input>
          <lc-input type="password" placeholder="Password"></lc-input>
        </div>
      `,
    },
    {
      title: "Joined with a button",
      render: () => html`
        <lc-join>
          <lc-input placeholder="Search..." size="md"></lc-input>
          <lc-button variant="primary" size="md">Search</lc-button>
        </lc-join>
      `,
    },
    {
      title: "States",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-input placeholder="Normal"></lc-input>
          <lc-input placeholder="Disabled" disabled></lc-input>
          <lc-input placeholder="Readonly" value="Read only text" readonly></lc-input>
          <lc-input placeholder="Required" required></lc-input>
        </div>
      `,
    },
  ],
};
