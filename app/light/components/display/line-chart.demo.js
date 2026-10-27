import { html } from "/app/light/html/index.js";

const signups = [
  { label: "Jan", value: 42 },
  { label: "Feb", value: 58 },
  { label: "Mar", value: 51 },
  { label: "Apr", value: 74 },
  { label: "May", value: 96 },
  { label: "Jun", value: 88 },
];

export default {
  description: "A line over a scale, with points and an area fill.",
  preview: () => html`
    <div style="width: 180px">
      <lc-line-chart .data=${[{ label: "J", value: 42 }, { label: "F", value: 58 }, { label: "M", value: 51 }, { label: "A", value: 74 }, { label: "M", value: 96 }]} height="80" show-area></lc-line-chart>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-line-chart .data=${signups} height="200"></lc-line-chart>
      `,
    },
    {
      title: "Filled area",
      description: "The area fades from the line colour to nothing at the baseline.",
      render: () => html`
        <lc-line-chart .data=${signups} height="200" show-area variant="success"></lc-line-chart>
      `,
    },
    {
      title: "Fitted, with a reference",
      description: "fit spans the values' own range instead of starting at zero, and reference draws a value, a target, as a dashed line.",
      render: () => html`
        <lc-line-chart .data=${[{ label: "Mon", value: 80.4 }, { label: "Tue", value: 80.1 }, { label: "Wed", value: 79.9 }, { label: "Thu", value: 79.6 }, { label: "Fri", value: 79.7 }, { label: "Sat", value: 79.2 }]} height="160" fit .reference=${78}></lc-line-chart>
      `,
    },
    {
      title: "Straight segments",
      render: () => html`
        <lc-line-chart .data=${signups} height="200" .smooth=${false}></lc-line-chart>
      `,
    },
  ],
};
