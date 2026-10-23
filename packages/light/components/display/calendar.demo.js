import { html } from "@bootstrapp/light/html";

const today = new Date();
const day = (/** @type {number} */ offset) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const events = [
  { id: "1", title: "Meetup Rio", date: day(2), time: "19:00" },
  { id: "2", title: "Release 0.3", date: day(5), time: "10:00" },
  { id: "3", title: "Retro", date: day(5), time: "16:30" },
  { id: "4", title: "Planning", date: day(0), time: "09:30" },
];

export default {
  description: "A month a reader picks a day from, with events marked.",
  preview: () => html`<lc-calendar .events=${events} .showViewToggle=${false}></lc-calendar>`,
  previewWidth: 640,
  examples: [
    {
      title: "Month with events",
      render: () => html`
        <lc-calendar .events=${events}></lc-calendar>
      `,
    },
    {
      title: "Week",
      description: "The seven days of the selected week as rows: a large numeral, the weekday, and that day's events.",
      render: () => html`
        <lc-calendar .events=${events} view-mode="week" .selectedDate=${day(0)}></lc-calendar>
      `,
    },
    {
      title: "Without the chrome",
      render: () => html`
        <lc-calendar .events=${events} .showViewToggle=${false} .showTodayButton=${false}></lc-calendar>
      `,
    },
  ],
};
