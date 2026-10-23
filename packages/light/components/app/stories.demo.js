import { html } from "@bootstrapp/light/html";

const items = [
  { id: "1", background: "#0f766e", title: "Doors open" },
  { id: "2", background: "#f97316", title: "First talk" },
  { id: "3", background: "#1a1a1a", title: "Open floor" },
];

export default {
  description: "Full-screen cards advanced by a tap or a swipe, with progress along the top.",
  preview: () => html`
    <div style="position: relative; width: 160px; height: 96px">
      <lc-card padding="sm" style="position: absolute; left: 0; top: 12px; width: 60px; height: 80px; opacity: 0.6; background: var(--color-surface-dark)"></lc-card>
      <lc-card padding="sm" style="position: absolute; right: 0; top: 12px; width: 60px; height: 80px; opacity: 0.6; background: var(--color-surface-dark)"></lc-card>
      <lc-card padding="sm" shadow="md" style="position: absolute; left: 45px; top: 0; width: 70px; height: 96px; background: var(--color-primary)">
        <div style="height: 3px; border-radius: 2px; background: var(--color-surface)"></div>
        <lc-text size="xs" weight="semibold" color="inverse">Doors open</lc-text>
      </lc-card>
    </div>
  `,
  examples: [
    {
      title: "Tap to advance",
      render: () => html`
        <div style="height:420px;width:260px">
          <lc-stories .items=${items} open></lc-stories>
        </div>
      `,
    },
  ],
};
