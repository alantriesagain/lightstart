import { html } from "@bootstrapp/light/html";

export default {
  description: "A message with a severity, inline in the page.",
  slot: () => "Your changes were saved.",
  preview: () => html`
    <lc-alert variant="success">Your changes were saved.</lc-alert>
  `,
  examples: [
    {
      title: "Severities",
      render: () => html`
        <lc-flex direction="column" gap="sm">
          <lc-alert variant="info">A new version is available.</lc-alert>
          <lc-alert variant="success">Your changes were saved.</lc-alert>
          <lc-alert variant="warning">This plan expires in three days.</lc-alert>
          <lc-alert variant="error">We could not reach the server.</lc-alert>
        </lc-flex>
      `,
    },
    {
      title: "Callout with a title",
      description: "A titled alert reads as a note in a page of prose.",
      render: () => html`
        <lc-alert variant="note" title="Note">A demo cannot reach <code>this</code>: it is a module, so anything an example needs is a constant above it.</lc-alert>
      `,
    },
    {
      title: "Note and tip",
      render: () => html`
        <lc-flex direction="column" gap="sm">
          <lc-alert variant="note" title="Note">Every write emits <code>model:changed</code>.</lc-alert>
          <lc-alert variant="tip" title="Tip">Ask for the rows you draw: push filters into <code>where</code>.</lc-alert>
        </lc-flex>
      `,
    },
    {
      title: "Own icon",
      description: "The severity picks an icon; naming one overrides it.",
      render: () => html`
        <lc-alert variant="info" icon="sparkles">Try the new editor.</lc-alert>
      `,
    },
  ],
};
