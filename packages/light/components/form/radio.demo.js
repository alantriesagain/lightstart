import { html } from "@bootstrapp/light/html";

export default {
  description: "One choice out of several, as a single button in a group.",
  slot: () => "Option",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-radio name="preview-radio" value="1" checked>Monthly</lc-radio>
      <lc-radio name="preview-radio" value="2">Yearly</lc-radio>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic group",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-radio name="option" value="1" checked>Option 1</lc-radio>
          <lc-radio name="option" value="2">Option 2</lc-radio>
          <lc-radio name="option" value="3">Option 3</lc-radio>
        </div>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-radio size="xs" name="size1" value="xs" checked>Extra small</lc-radio>
          <lc-radio size="sm" name="size2" value="sm" checked>Small</lc-radio>
          <lc-radio size="md" name="size3" value="md" checked>Medium</lc-radio>
          <lc-radio size="lg" name="size4" value="lg" checked>Large</lc-radio>
          <lc-radio size="xl" name="size5" value="xl" checked>Extra large</lc-radio>
        </div>
      `,
    },
    {
      title: "Color variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-radio variant="primary" name="color1" checked>Primary</lc-radio>
          <lc-radio variant="secondary" name="color2" checked>Secondary</lc-radio>
          <lc-radio variant="success" name="color3" checked>Success</lc-radio>
          <lc-radio variant="warning" name="color4" checked>Warning</lc-radio>
          <lc-radio variant="error" name="color5" checked>Error</lc-radio>
        </div>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-radio name="disabled" value="1" disabled>Disabled unchecked</lc-radio>
          <lc-radio name="disabled" value="2" checked disabled>Disabled checked</lc-radio>
        </div>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <fieldset>
            <legend>Choose your plan:</legend>
            <lc-radio name="plan" value="basic" required>Basic - $9/mo</lc-radio>
            <lc-radio name="plan" value="pro">Pro - $29/mo</lc-radio>
            <lc-radio name="plan" value="enterprise">Enterprise - $99/mo</lc-radio>
          </fieldset>
          <lc-button primary type="submit">Continue</lc-button>
        </form>
      `,
    },
  ],
};
