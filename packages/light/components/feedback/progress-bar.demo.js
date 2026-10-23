import { html } from "@bootstrapp/light/html";

export default {
  description: "How far along something is, determinate or not.",
  preview: () => html`
    <lc-progress-bar value="65" variant="success" show-label></lc-progress-bar>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-progress-bar value="50"></lc-progress-bar>
      `,
    },
    {
      title: "Label",
      render: () => html`
        <lc-progress-bar value="75" showLabel></lc-progress-bar>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-progress-bar value="60" size="sm" showLabel></lc-progress-bar>
          <lc-progress-bar value="60" size="md" showLabel></lc-progress-bar>
          <lc-progress-bar value="60" size="lg" showLabel></lc-progress-bar>
        </div>
      `,
    },
    {
      title: "Variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-progress-bar value="25" variant="default"></lc-progress-bar>
          <lc-progress-bar value="50" variant="success"></lc-progress-bar>
          <lc-progress-bar value="75" variant="warning"></lc-progress-bar>
          <lc-progress-bar value="90" variant="danger"></lc-progress-bar>
          <lc-progress-bar value="100" variant="info"></lc-progress-bar>
        </div>
      `,
    },
    {
      title: "Striped and animated",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-progress-bar value="60" striped></lc-progress-bar>
          <lc-progress-bar value="60" striped animated></lc-progress-bar>
        </div>
      `,
    },
    {
      title: "Complete with all features",
      render: () => html`
        <lc-progress-bar
          value="85"
          max="100"
          variant="success"
          size="lg"
          showLabel
          striped
          animated
        ></lc-progress-bar>
      `,
    },
  ],
};
