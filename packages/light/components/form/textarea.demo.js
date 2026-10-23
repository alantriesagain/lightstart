import { html } from "@bootstrapp/light/html";

export default {
  description: "Multi-line text, growing with what is typed when asked to.",
  preview: () => html`
    <lc-textarea rows="3" placeholder="Write a message..."></lc-textarea>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-textarea placeholder="Enter your message..."></lc-textarea>
      `,
    },
    {
      title: "Custom rows",
      render: () => html`
        <lc-textarea rows="8" placeholder="Long message..."></lc-textarea>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-textarea size="xs" placeholder="Extra small" rows="2"></lc-textarea>
          <lc-textarea size="sm" placeholder="Small" rows="3"></lc-textarea>
          <lc-textarea size="md" placeholder="Medium" rows="4"></lc-textarea>
          <lc-textarea size="lg" placeholder="Large" rows="5"></lc-textarea>
          <lc-textarea size="xl" placeholder="Extra large" rows="6"></lc-textarea>
        </div>
      `,
    },
    {
      title: "Resize options",
      render: () => html`
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <lc-textarea resize="none" placeholder="No resize"></lc-textarea>
          <lc-textarea resize="vertical" placeholder="Vertical resize"></lc-textarea>
          <lc-textarea resize="horizontal" placeholder="Horizontal resize"></lc-textarea>
          <lc-textarea resize="both" placeholder="Both resize"></lc-textarea>
        </div>
      `,
    },
    {
      title: "Character limit",
      render: () => html`
        <lc-textarea maxlength="200" placeholder="Max 200 characters"></lc-textarea>
      `,
    },
    {
      title: "States",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-textarea placeholder="Normal"></lc-textarea>
          <lc-textarea placeholder="Disabled" disabled></lc-textarea>
          <lc-textarea placeholder="Readonly" value="Read only text" readonly></lc-textarea>
          <lc-textarea placeholder="Required" required></lc-textarea>
        </div>
      `,
    },
  ],
};
