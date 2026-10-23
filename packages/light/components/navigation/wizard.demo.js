import { html } from "@bootstrapp/light/html";

export default {
  description: "A sequence of steps with progress and validation between them.",
  previewWidth: 640,
  preview: () => html`
    <lc-wizard current-step="1" total-steps="3" step-label="Details">
      <lc-input label="Event title" value="Meetup Rio"></lc-input>
    </lc-wizard>
  `,
  examples: [
    {
      title: "Three steps",
      render: () => html`
        <lc-wizard current-step="1" total-steps="3" step-label="Details">
          <lc-input label="Event title" value="Meetup Rio"></lc-input>
        </lc-wizard>
      `,
    },
    {
      title: "Without the counter",
      render: () => html`
        <lc-wizard current-step="0" total-steps="3" .showStepCounter=${false}>
          <lc-text>Step content goes in the slot.</lc-text>
        </lc-wizard>
      `,
    },
  ],
};
