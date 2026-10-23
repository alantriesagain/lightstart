import { html } from "@bootstrapp/light/html";

export default {
  description: "A short status beside the thing it describes.",
  slot: () => "Badge",
  preview: () => html`
    <lc-flex gap="sm" align="center">
      <lc-badge variant="success">Active</lc-badge>
      <lc-badge variant="danger">5</lc-badge>
      <lc-badge variant="info" outline>Beta</lc-badge>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-badge>Default</lc-badge>
      `,
    },
    {
      title: "Variants",
      description: "Different colors for various statuses",
      render: () => html`
        <lc-badge variant="default">Default</lc-badge>
        <lc-badge variant="success">Active</lc-badge>
        <lc-badge variant="danger">Error</lc-badge>
        <lc-badge variant="warning">Warning</lc-badge>
        <lc-badge variant="info">Info</lc-badge>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-badge size="sm">Small</lc-badge>
        <lc-badge size="md">Medium</lc-badge>
        <lc-badge size="lg">Large</lc-badge>
      `,
    },
    {
      title: "Count",
      render: () => html`
        <lc-badge variant="danger">5</lc-badge>
        <lc-badge variant="success">New</lc-badge>
      `,
    },
    {
      title: "Outline",
      render: () => html`
        <lc-badge variant="success" outline>Approved</lc-badge>
      `,
    },
    {
      title: "Soft, with a leading dot",
      description: "A soft badge tints instead of filling; dot on a badge with a label draws a dot before it.",
      render: () => html`
        <lc-badge soft dot variant="success">Live</lc-badge>
        <lc-badge soft dot variant="primary">Scheduled</lc-badge>
        <lc-badge soft variant="default">Draft</lc-badge>
      `,
    },
    {
      title: "A dot, for \"something is here\" with no number to show",
      render: () => html`
        <lc-badge dot primary></lc-badge>
        <lc-button iconOnly icon="bell"><lc-badge dot corner secondary></lc-badge></lc-button>
      `,
    },
  ],
};
