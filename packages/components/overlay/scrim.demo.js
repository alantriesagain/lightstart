import { html } from "@lightstart/light/html";

/** @param {Event} e */
const closeScrim = (e) => {
  const scrim = /** @type {{ open: boolean } | null} */ (/** @type {HTMLElement} */ (e.target).closest("lc-scrim"));
  if (scrim) scrim.open = false;
};

export default {
  description: "A backdrop over the page or a container that reports a dismissal instead of closing itself.",
  preview: () => html`
    <div style="position: relative; width: 160px; height: 100px; overflow: hidden; border-radius: 6px; background: var(--color-surface)">
      <div style="position: absolute; inset: 0; background: var(--canvas-backdrop, rgba(0, 0, 0, 0.5))"></div>
      <div style="position: absolute; inset: 20px 28px; border-radius: 6px; background: var(--color-surface); box-shadow: var(--shadow-box, 0 8px 24px rgba(0, 0, 0, 0.2))"></div>
    </div>
  `,
  examples: [
    {
      title: "Contained",
      description: "`contained` keeps the scrim inside its own positioned container.",
      render: () => html`
        <div style="position: relative; height: 180px; overflow: hidden; border-radius: 8px; background: var(--color-surface)">
          <lc-scrim contained open></lc-scrim>
          <lc-panel style="position: relative; z-index: 901; margin: 24px">A panel above the scrim</lc-panel>
        </div>
      `,
    },
    {
      title: "Blur, and an owner that closes it",
      description: "A dismissal is the scrim's whole report; the owner sets `open`.",
      render: () => html`
        <div style="position: relative; height: 180px; overflow: hidden; border-radius: 8px; background: var(--color-surface)">
          <lc-scrim contained open blurred @dismiss=${closeScrim}></lc-scrim>
          <lc-panel style="position: relative; z-index: 901; margin: 24px">Click the scrim to dismiss</lc-panel>
        </div>
      `,
    },
  ],
};
