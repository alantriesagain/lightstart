import { html } from "@bootstrapp/light/html";

export default {
  description: "A set of radios that share a name and a value.",
  slot: () => html`
    <lc-radio value="a">Option A</lc-radio>
    <lc-radio value="b">Option B</lc-radio>
    <lc-radio value="c">Option C</lc-radio>
  `,
  preview: () => html`
    <lc-radio-group name="preview-plan" value="pro">
      <lc-radio value="basic">Basic</lc-radio>
      <lc-radio value="pro">Pro</lc-radio>
      <lc-radio value="team">Team</lc-radio>
    </lc-radio-group>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-radio-group name="plan" value="basic">
          <lc-radio value="basic">Basic - $9/mo</lc-radio>
          <lc-radio value="pro">Pro - $29/mo</lc-radio>
          <lc-radio value="enterprise">Enterprise - $99/mo</lc-radio>
        </lc-radio-group>
      `,
    },
    {
      title: "Horizontal orientation",
      render: () => html`
        <lc-radio-group name="theme" orientation="horizontal" value="dark">
          <lc-radio value="light">Light</lc-radio>
          <lc-radio value="dark">Dark</lc-radio>
          <lc-radio value="auto">Auto</lc-radio>
        </lc-radio-group>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-radio-group name="size1" size="xs" value="a">
            <lc-radio value="a">Option A</lc-radio>
            <lc-radio value="b">Option B</lc-radio>
          </lc-radio-group>

          <lc-radio-group name="size2" size="lg" value="a">
            <lc-radio value="a">Option A</lc-radio>
            <lc-radio value="b">Option B</lc-radio>
          </lc-radio-group>
        </div>
      `,
    },
    {
      title: "Color variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-radio-group name="variant1" variant="primary" value="yes">
            <lc-radio value="yes">Yes</lc-radio>
            <lc-radio value="no">No</lc-radio>
          </lc-radio-group>

          <lc-radio-group name="variant2" variant="success" value="yes">
            <lc-radio value="yes">Yes</lc-radio>
            <lc-radio value="no">No</lc-radio>
          </lc-radio-group>
        </div>
      `,
    },
    {
      title: "Disabled",
      render: () => html`
        <lc-radio-group name="disabled" disabled value="option1">
          <lc-radio value="option1">Option 1</lc-radio>
          <lc-radio value="option2">Option 2</lc-radio>
          <lc-radio value="option3">Option 3</lc-radio>
        </lc-radio-group>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <label>Select your subscription:</label>
          <lc-radio-group name="subscription" required>
            <lc-radio value="monthly">Monthly</lc-radio>
            <lc-radio value="yearly">Yearly (Save 20%)</lc-radio>
          </lc-radio-group>
          <lc-button primary type="submit">Continue</lc-button>
        </form>
      `,
    },
  ],
};
