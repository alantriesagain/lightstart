import { html } from "@bootstrapp/light/html";

export default {
  description: "A number chosen by dragging, with a live value beside it.",
  preview: () => html`
    <lc-slider variant="primary" value="65"></lc-slider>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-slider value="50"></lc-slider>
      `,
    },
    {
      title: "Min, max, and step",
      render: () => html`
        <lc-slider min="0" max="10" step="0.5" value="5"></lc-slider>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 1rem;">
          <lc-slider size="xs" value="25"></lc-slider>
          <lc-slider size="sm" value="50"></lc-slider>
          <lc-slider size="md" value="75"></lc-slider>
          <lc-slider size="lg" value="50"></lc-slider>
          <lc-slider size="xl" value="25"></lc-slider>
        </div>
      `,
    },
    {
      title: "Color variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; width: 100%; max-width: 360px; gap: 1rem;">
          <lc-slider variant="primary" value="70"></lc-slider>
          <lc-slider variant="secondary" value="60"></lc-slider>
          <lc-slider variant="success" value="80"></lc-slider>
          <lc-slider variant="warning" value="40"></lc-slider>
          <lc-slider variant="error" value="30"></lc-slider>
        </div>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <lc-slider value="60" disabled></lc-slider>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <label>Volume: <lc-slider name="volume" min="0" max="100" value="50"></lc-slider></label>
          <lc-button primary type="submit">Submit</lc-button>
        </form>
      `,
    },
  ],
};
