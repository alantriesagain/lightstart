import { html } from "@bootstrapp/light/html";

export default {
  description: "A short hint on hover or focus.",
  slot: () => html`<lc-button>Hover me</lc-button>`,
  preview: () => html`
    <div class="flex flex-col gap-1 items-center">
      <div class="px-2 py-1 rounded text-xs" style="background: var(--color-surface-inverse); color: var(--color-inverse)">Copy to clipboard</div>
      <lc-button size="sm"><lc-icon name="copy"></lc-icon></lc-button>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-button>
          Hover me
          <lc-tooltip>Helpful information here</lc-tooltip>
        </lc-button>
      `,
    },
    {
      title: "Different positions",
      render: () => html`
        <lc-button>
          Right
          <lc-tooltip position="right">Right tooltip</lc-tooltip>
        </lc-button>
      `,
    },
    {
      title: "Custom delay",
      render: () => html`
        <lc-button>
          Instant
          <lc-tooltip delay="0">Shows immediately</lc-tooltip>
        </lc-button>
      `,
    },
  ],
};
