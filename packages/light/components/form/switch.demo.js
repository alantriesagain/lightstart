import { html } from "@bootstrapp/light/html";

export default {
  description: "An on and off that applies immediately, unlike a checkbox that waits for a submit.",
  slot: () => "Enable notifications",
  preview: () => html`
    <lc-flex direction="column" gap="sm">
      <lc-switch checked label="Notifications"></lc-switch>
      <lc-switch label="Dark mode"></lc-switch>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-switch></lc-switch>
      `,
    },
    {
      title: "Label",
      render: () => html`
        <lc-switch label="Enable notifications" checked></lc-switch>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-switch size="xs" label="Extra small"></lc-switch>
          <lc-switch size="sm" label="Small"></lc-switch>
          <lc-switch size="md" label="Medium"></lc-switch>
          <lc-switch size="lg" label="Large"></lc-switch>
          <lc-switch size="xl" label="Extra large"></lc-switch>
        </div>
      `,
    },
    {
      title: "Color variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-switch variant="primary" label="Primary" checked></lc-switch>
          <lc-switch variant="secondary" label="Secondary" checked></lc-switch>
          <lc-switch variant="success" label="Success" checked></lc-switch>
          <lc-switch variant="warning" label="Warning" checked></lc-switch>
          <lc-switch variant="error" label="Error" checked></lc-switch>
        </div>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <div style="display: flex; gap: 1rem;">
          <lc-switch label="Disabled off" disabled></lc-switch>
          <lc-switch label="Disabled on" disabled checked></lc-switch>
        </div>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <lc-switch name="newsletter" value="yes" label="Subscribe to newsletter"></lc-switch>
          <lc-button primary type="submit">Submit</lc-button>
        </form>
      `,
    },
  ],
};
