import { html } from "/app/light/html/index.js";

export default {
  description: "A panel the reader drags around the screen.",
  preview: () => html`
    <div class="p-3" style="background: var(--color-surface-dark); height: 100px">
      <lc-card padding="sm" shadow="md" style="width: 70%; margin-left: 20%"><div class="flex gap-2 items-center"><lc-icon name="grip-vertical"></lc-icon><lc-text size="sm" weight="semibold">Layers</lc-text></div>
        <lc-text size="xs" muted>Drag me by the edge.</lc-text></lc-card>
    </div>
  `,
  examples: [
    {
      title: "Drag it",
      render: () => html`
        <anim-drag-panel>
          <lc-card padding="md">Drag this panel by its edge.</lc-card>
        </anim-drag-panel>
      `,
    },
  ],
};
