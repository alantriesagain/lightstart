import { html } from "@bootstrapp/light/html";

export default {
  description: "A small layer anchored to a trigger, for a form or a detail.",
  slot: () => html`<p>Popover content</p>`,
  preview: () => html`
    <div class="flex flex-col gap-1 items-start">
      <lc-button size="xs">Show info</lc-button>
      <lc-card padding="sm" shadow="md"><lc-text size="sm" weight="semibold">Shipping</lc-text><lc-text size="xs" muted>Arrives in 3 to 5 days.</lc-text></lc-card>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-button popovertarget="info-popover">Show Info</lc-button>
        <lc-popover id="info-popover">
          <div>Popover content here...</div>
        </lc-popover>
      `,
    },
    {
      title: "Different positions",
      render: () => html`
        <lc-button popovertarget="top-popover">Top</lc-button>
        <lc-popover id="top-popover" position="top">
          <div>Content above</div>
        </lc-popover>

        <lc-button popovertarget="bottom-popover">Bottom</lc-button>
        <lc-popover id="bottom-popover" position="bottom">
          <div>Content below</div>
        </lc-popover>
      `,
    },
    {
      title: "Without arrow",
      render: () => html`
        <lc-button popovertarget="no-arrow">No Arrow</lc-button>
        <lc-popover id="no-arrow" arrow="false">
          <div>Content without arrow</div>
        </lc-popover>
      `,
    },
  ],
};
