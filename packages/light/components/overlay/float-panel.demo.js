import { html } from "@bootstrapp/light/html";

export default {
  description: "A floating window that remembers where it was left.",
  preview: () => html`
    <div class="p-3" style="background: var(--color-surface-dark); height: 100px">
      <lc-card padding="sm" shadow="md" style="width: 75%"><div class="flex gap-2 items-center justify-between"><lc-text size="sm" weight="semibold">Notes</lc-text><lc-icon name="x"></lc-icon></div>
        <lc-text size="xs" muted>Buy milk, call Ana.</lc-text></lc-card>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-float-panel storage-key="notes-float-rect">
          <div data-float-handle class="flex items-center gap-2 px-2 py-1.5">Notes</div>
          <div class="flex-1 min-h-0 overflow-auto">…</div>
        </lc-float-panel>
      `,
    },
  ],
};
