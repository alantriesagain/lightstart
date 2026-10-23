import { html } from "@bootstrapp/light/html";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ value: day, label: day.slice(0, 3) }));

export default {
  description: "A few short options as one pill-shaped strip: one pick, or several with multiple.",
  preview: () => html`
    <lc-segmented .options=${["Day", "Week", "Month"]} value="Week"></lc-segmented>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-segmented .options=${["Day", "Week", "Month"]} value="Week"></lc-segmented>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex direction="column" gap="sm" align="start">
          <lc-segmented size="sm" .options=${["One", "Two"]} value="One"></lc-segmented>
          <lc-segmented size="md" .options=${["One", "Two"]} value="One"></lc-segmented>
          <lc-segmented size="lg" .options=${["One", "Two"]} value="One"></lc-segmented>
        </lc-flex>
      `,
    },
    {
      title: "Full width",
      render: () => html`
        <div style="width:320px">
          <lc-segmented block .options=${["Going", "Maybe", "No"]} value="Going"></lc-segmented>
        </div>
      `,
    },
    {
      title: "Several at once",
      description: "With multiple, each segment toggles on its own and values holds the ones that are on.",
      render: () => html`
        <div style="width:360px">
          <lc-segmented multiple block .options=${DAYS} .values=${["Tuesday", "Thursday", "Sunday"]}></lc-segmented>
        </div>
      `,
    },
  ],
};
