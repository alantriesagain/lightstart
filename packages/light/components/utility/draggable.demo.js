import { html } from "@bootstrapp/light/html";

export default {
  description: "Makes its children draggable, and says where they were dropped.",
  preview: () => html`
    <lc-card padding="sm" style="width: 150px">
      <lc-flex gap="sm" align="center">
        <lc-icon name="grip-vertical" size="16"></lc-icon>
        <lc-text size="sm">Drag me</lc-text>
      </lc-flex>
    </lc-card>
  `,
  examples: [
    {
      title: "Drag the children",
      render: () => html`
        <lc-draggable>
          <lc-flex gap="sm">
            <lc-card padding="md">One</lc-card>
            <lc-card padding="md">Two</lc-card>
            <lc-card padding="md">Three</lc-card>
          </lc-flex>
        </lc-draggable>
      `,
    },
  ],
};
