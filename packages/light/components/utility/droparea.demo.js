import { html } from "@bootstrapp/light/html";

export default {
  description: "A region that takes a drop, of files or of a dragged element.",
  preview: () => html`
    <lc-panel padding="sm" style="width: 180px; border: 2px dashed var(--color-primary); border-radius: var(--radius-lg, 0.5rem); --lc-panel-border-color: transparent">
      <lc-flex direction="column" gap="xs" align="center">
        <lc-icon name="upload" size="20"></lc-icon>
        <lc-text size="sm" muted>Drop a file here</lc-text>
      </lc-flex>
    </lc-panel>
  `,
  examples: [
    {
      title: "Drop a file on it",
      render: () => html`
        <lc-droparea>
          <lc-empty-state icon="upload" title="Drop a file here" description="Or click to choose one."></lc-empty-state>
        </lc-droparea>
      `,
    },
    {
      title: "Reorderable",
      render: () => html`
        <lc-droparea orderable direction="vertical">
          <lc-list>
            <lc-list-item>First</lc-list-item>
            <lc-list-item>Second</lc-list-item>
            <lc-list-item>Third</lc-list-item>
          </lc-list>
        </lc-droparea>
      `,
    },
  ],
};
