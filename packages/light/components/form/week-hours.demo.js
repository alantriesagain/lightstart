import { html } from "@bootstrapp/light/html";

const BAR = [
  { days: [2, 3, 4], open: "18:00", close: "01:00" },
  { days: [5, 6], open: "18:00", close: "02:00" },
  { days: [0], open: "17:00", close: "00:00" },
];

export default {
  description: "Opening hours for a week: a row a day, open or closed, and the hours it keeps.",
  preview: () => html`
    <div style="width:340px">
      <lc-week-hours .value=${BAR}></lc-week-hours>
    </div>
  `,
  examples: [
    {
      title: "A bar open late",
      description: "Hours that close after midnight say so. Each edit reports the whole week, grouped by the hours the days share.",
      render: () => html`
        <div style="width:380px">
          <lc-week-hours label="Opening hours" .value=${BAR}
            @change=${(/** @type {CustomEvent<{ value: unknown }>} */ e) => console.log(e.detail.value)}></lc-week-hours>
        </div>
      `,
    },
    {
      title: "Empty, starting on Sunday, in Portuguese",
      render: () => html`
        <div style="width:380px">
          <lc-week-hours first-day="0" locale="pt-BR"></lc-week-hours>
        </div>
      `,
    },
    {
      title: "Disabled",
      render: () => html`
        <div style="width:380px">
          <lc-week-hours .value=${BAR} disabled></lc-week-hours>
        </div>
      `,
    },
  ],
};
