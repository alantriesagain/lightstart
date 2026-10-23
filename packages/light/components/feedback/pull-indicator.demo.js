import { html } from "@bootstrapp/light/html";

export default {
  description: "The hint above a list being pulled to refresh: how far so far, whether a release refreshes, and the refresh running.",
  preview: () => html`
    <div style="display: flex; gap: 1.5rem; align-items: flex-end;">
      <lc-pull-indicator .pull=${20}></lc-pull-indicator>
      <lc-pull-indicator .pull=${72}></lc-pull-indicator>
      <lc-pull-indicator refreshing></lc-pull-indicator>
    </div>
  `,
  examples: [
    {
      title: "Pulling",
      render: () => html`<lc-pull-indicator .pull=${20}></lc-pull-indicator>`,
    },
    {
      title: "Past the threshold",
      render: () => html`<lc-pull-indicator .pull=${72}></lc-pull-indicator>`,
    },
    {
      title: "Refreshing",
      render: () => html`<lc-pull-indicator refreshing></lc-pull-indicator>`,
    },
  ],
};
