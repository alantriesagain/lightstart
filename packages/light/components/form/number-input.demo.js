import { html } from "@bootstrapp/light/html";

export default {
  description: "A number with steppers, bounds and its own empty state, which is null rather than zero.",
  preview: () => html`
    <lc-number-input stepper label="Guests" value="4" min="0"></lc-number-input>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-number-input value="5"></lc-number-input>
      `,
    },
    {
      title: "Stepper: tap to adjust",
      render: () => html`
        <lc-number-input stepper size="lg" label="Reps" value="8" min="0"></lc-number-input>
        <lc-number-input stepper label="Weight" unit="kg" value="60" step="2.5" min="0"></lc-number-input>
      `,
    },
    {
      title: "Min, max, and step",
      render: () => html`
        <lc-number-input min="0" max="100" step="5" value="50"></lc-number-input>
      `,
    },
    {
      title: "Without buttons",
      render: () => html`
        <lc-number-input value="42" show-buttons="false"></lc-number-input>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-number-input size="xs" value="1"></lc-number-input>
          <lc-number-input size="sm" value="2"></lc-number-input>
          <lc-number-input size="md" value="3"></lc-number-input>
          <lc-number-input size="lg" value="4"></lc-number-input>
          <lc-number-input size="xl" value="5"></lc-number-input>
        </div>
      `,
    },
    {
      title: "Decimal values",
      render: () => html`
        <lc-number-input value="3.14" step="0.01" placeholder="Enter price"></lc-number-input>
      `,
    },
    {
      title: "States",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 0.5rem;">
          <lc-number-input value="10" placeholder="Normal"></lc-number-input>
          <lc-number-input value="10" disabled>Disabled</lc-number-input>
          <lc-number-input value="10" readonly>Read only</lc-number-input>
          <lc-number-input required placeholder="Required"></lc-number-input>
        </div>
      `,
    },
    {
      title: "As a quantity",
      render: () => html`
        <form>
          <label>Quantity:
            <lc-number-input name="quantity" min="1" max="10" value="1"></lc-number-input>
          </label>
          <lc-button primary type="submit">Add to Cart</lc-button>
        </form>
      `,
    },
  ],
};
