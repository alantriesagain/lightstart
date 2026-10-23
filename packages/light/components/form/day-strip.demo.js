import { html } from "@bootstrapp/light/html";

const today = new Date().toISOString().slice(0, 10);
const plus = (/** @type {number} */ n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default {
  description: "A week of days as one row, any one a tap away, with a dot under the days that have something on.",
  preview: () => html`
    <div style="width:300px">
      <lc-day-strip value=${today} .dots=${[today, plus(2), plus(5)]}></lc-day-strip>
    </div>
  `,
  examples: [
    {
      title: "This week, today picked",
      render: () => html`
        <div style="width:360px">
          <lc-day-strip value=${today} .dots=${[today, plus(2), plus(5)]} @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => console.log(e.detail.value)}></lc-day-strip>
        </div>
      `,
    },
    {
      title: "A stay: five days from a date, in Rio time and in Portuguese",
      render: () => html`
        <div style="width:300px">
          <lc-day-strip from=${plus(10)} value=${plus(11)} days="5" timezone="America/Sao_Paulo" locale="pt-BR"></lc-day-strip>
        </div>
      `,
    },
    {
      title: "Disabled",
      render: () => html`
        <div style="width:360px">
          <lc-day-strip value=${today} disabled></lc-day-strip>
        </div>
      `,
    },
  ],
};
