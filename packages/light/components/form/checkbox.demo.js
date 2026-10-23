import { html } from "@bootstrapp/light/html";

export default {
  description: "A box a reader ticks. Takes its own label, so a form does not have to pair it with one.",
  slot: () => "Accept terms",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-checkbox checked label="Accept terms"></lc-checkbox>
      <lc-checkbox label="Send me updates"></lc-checkbox>
    </lc-flex>
  `,
  examples: [
    {
      title: "Round, as a state ring",
      render: () => html`
        <lc-flex gap="md" align="center">
          <lc-checkbox shape="round" size="sm" aria-label="To do"></lc-checkbox>
          <lc-checkbox shape="round" size="sm" variant="warning" indeterminate aria-label="In progress"></lc-checkbox>
          <lc-checkbox shape="round" size="sm" variant="success" checked aria-label="Done"></lc-checkbox>
        </lc-flex>
      `,
    },
    {
      title: "Basic",
      render: () => html`
        <lc-checkbox label="Accept terms and conditions"></lc-checkbox>
      `,
    },
    {
      title: "Checked by default",
      render: () => html`
        <lc-checkbox checked label="Subscribe to newsletter"></lc-checkbox>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-checkbox size="xs" label="Extra small"></lc-checkbox>
          <lc-checkbox size="sm" label="Small"></lc-checkbox>
          <lc-checkbox size="md" checked label="Medium"></lc-checkbox>
          <lc-checkbox size="lg" label="Large"></lc-checkbox>
          <lc-checkbox size="xl" label="Extra large"></lc-checkbox>
        </div>
      `,
    },
    {
      title: "Color variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-checkbox variant="primary" checked label="Primary"></lc-checkbox>
          <lc-checkbox variant="secondary" checked label="Secondary"></lc-checkbox>
          <lc-checkbox variant="success" checked label="Success"></lc-checkbox>
          <lc-checkbox variant="warning" checked label="Warning"></lc-checkbox>
          <lc-checkbox variant="error" checked label="Error"></lc-checkbox>
        </div>
      `,
    },
    {
      title: "Indeterminate state",
      render: () => html`
        <lc-checkbox indeterminate label="Select all"></lc-checkbox>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-checkbox disabled label="Disabled unchecked"></lc-checkbox>
          <lc-checkbox checked disabled label="Disabled checked"></lc-checkbox>
        </div>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <lc-checkbox name="newsletter" value="yes" label="Subscribe to newsletter"></lc-checkbox>
          <lc-checkbox name="terms" value="accepted" required label="Accept terms"></lc-checkbox>
          <lc-button primary type="submit">Submit</lc-button>
        </form>
      `,
    },
  ],
};
