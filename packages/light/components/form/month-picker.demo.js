import { html } from "@bootstrapp/light/html";

const today = new Date().toISOString().slice(0, 10);
const plus = (/** @type {number} */ n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default {
  description: "A month as a grid of days, to pick one day or a first and a last, with a dot under the days that have something on.",
  preview: () => html`
    <div style="width:300px">
      <lc-month-picker range from=${plus(3)} to=${plus(6)} min=${today} .dots=${[today, plus(2), plus(5)]}></lc-month-picker>
    </div>
  `,
  examples: [
    {
      title: "One day",
      render: () => html`
        <div style="width:320px">
          <lc-month-picker value=${plus(1)} min=${today} .dots=${[today, plus(2), plus(5)]} @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => console.log(e.detail.value)}></lc-month-picker>
        </div>
      `,
    },
    {
      title: "A stay: a first and a last, in Rio time and in Portuguese",
      render: () => html`
        <div style="width:320px">
          <lc-month-picker range from=${plus(3)} to=${plus(6)} min=${today} timezone="America/Sao_Paulo" locale="pt-BR" @change=${(/** @type {CustomEvent<{ from: string, to: string }>} */ e) => console.log(e.detail.from, e.detail.to)}></lc-month-picker>
        </div>
      `,
    },
    {
      title: "Sunday first, no navigation",
      render: () => html`
        <div style="width:320px">
          <lc-month-picker value=${today} weekStart="0" .navigation=${false}></lc-month-picker>
        </div>
      `,
    },
    {
      title: "Disabled",
      render: () => html`
        <div style="width:320px">
          <lc-month-picker value=${today} disabled></lc-month-picker>
        </div>
      `,
    },
  ],
};
