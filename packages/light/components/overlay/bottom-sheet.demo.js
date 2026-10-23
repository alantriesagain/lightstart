import { html } from "@bootstrapp/light/html";

export default {
  description: "A panel that rises from the bottom edge and settles at a detent the reader drags it to.",
  preview: () => html`
    <div class="flex flex-col justify-end pt-6" style="background: var(--color-surface-dark)">
      <lc-panel variant="elevated" padding="sm"><div class="flex flex-col gap-2 items-center"><div class="w-8 h-1 rounded-full" style="background: var(--border-color)"></div>
        <lc-text weight="semibold">Filter events</lc-text><lc-button size="xs" primary>Apply</lc-button></div></lc-panel>
    </div>
  `,
  examples: [
    {
      title: "Open at a detent",
      description: "The reader drags it between stops; Escape closes it.",
      render: () => html`
        <lc-bottom-sheet open detent="half">
          <lc-flex direction="column" gap="sm">
            <lc-text level="3" size="lg">Filter events</lc-text>
            <lc-segmented .options=${["All", "Free", "Nearby"]} value="All"></lc-segmented>
            <lc-button primary>Apply</lc-button>
          </lc-flex>
        </lc-bottom-sheet>
      `,
    },
  ],
};
