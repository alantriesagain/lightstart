import { html } from "@bootstrapp/light/html";

const revenue = [
  { label: "Mon", value: 12 },
  { label: "Tue", value: 19 },
  { label: "Wed", value: 8 },
  { label: "Thu", value: 24 },
  { label: "Fri", value: 31 },
  { label: "Sat", value: 27 },
  { label: "Sun", value: 14 },
];

export default {
  description: "Bars against a shared scale, with its own empty state.",
  preview: () => html`
    <div style="width: 180px">
      <lc-bar-chart .data=${[{ label: "M", value: 12 }, { label: "T", value: 19 }, { label: "W", value: 8 }, { label: "T", value: 24 }, { label: "F", value: 31 }]} height="80"></lc-bar-chart>
    </div>
  `,
  examples: [
    {
      title: "Vertical",
      render: () => html`
        <lc-bar-chart .data=${revenue} height="180" show-values></lc-bar-chart>
      `,
    },
    {
      title: "Axis and callout",
      description: "Five gridlines with their values on the left, and a bubble over the current bar.",
      render: () => html`
        <lc-bar-chart .data=${revenue} .currentIndex=${4} callout="31K" height="200" show-axis></lc-bar-chart>
      `,
    },
    {
      title: "Horizontal",
      render: () => html`
        <lc-bar-chart .data=${revenue} horizontal show-values></lc-bar-chart>
      `,
    },
    {
      title: "No data",
      description: "Every chart carries its own empty state.",
      render: () => html`
        <lc-bar-chart .data=${[]}></lc-bar-chart>
      `,
    },
  ],
};
