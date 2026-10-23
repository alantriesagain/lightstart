import { html } from "@bootstrapp/light/html";

const sources = [
  { label: "Direct", value: 46 },
  { label: "Search", value: 28 },
  { label: "Social", value: 18 },
  { label: "Referral", value: 8 },
];

export default {
  description: "Parts of a whole, with a legend and percentages.",
  preview: () => html`<lc-pie-chart .data=${sources} size="90" donut donut-width="18" .showLegend=${false}></lc-pie-chart>`,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-pie-chart .data=${sources}></lc-pie-chart>
      `,
    },
    {
      title: "Donut",
      render: () => html`
        <lc-pie-chart .data=${sources} donut show-labels></lc-pie-chart>
      `,
    },
    {
      title: "Donut with a centre label",
      render: () => html`
        <lc-pie-chart .data=${sources} donut donut-width="28" center-label="12.4K" center-sub="visits"></lc-pie-chart>
      `,
    },
  ],
};
