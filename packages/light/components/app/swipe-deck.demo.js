import { html } from "@bootstrapp/light/html";

const items = [
  { id: "1", title: "Meetup Rio", subtitle: "Tonight, 19:00" },
  { id: "2", title: "JS Sampa", subtitle: "Thursday, 19:30" },
  { id: "3", title: "Belo Code", subtitle: "Saturday, 10:00" },
];

export default {
  description: "A stack of cards swiped left or right.",
  preview: () => html`
    <div style="position: relative; width: 150px; height: 96px">
      <lc-card padding="sm" style="position: absolute; left: 20px; top: 0; width: 110px; height: 80px; transform: rotate(-6deg); opacity: 0.6"></lc-card>
      <lc-card padding="sm" style="position: absolute; left: 20px; top: 4px; width: 110px; height: 80px; transform: rotate(4deg); opacity: 0.8"></lc-card>
      <lc-card padding="sm" shadow="md" style="position: absolute; left: 20px; top: 8px; width: 110px; height: 80px">
        <lc-text size="sm" weight="semibold">Meetup Rio</lc-text>
        <lc-text size="xs" muted>Tonight, 19:00</lc-text>
      </lc-card>
    </div>
  `,
  examples: [
    {
      title: "Swipe left or right",
      render: () => html`
        <div style="height:320px;width:260px">
          <lc-swipe-deck .items=${items} .labels=${{ left: "Skip", right: "Going" }}></lc-swipe-deck>
        </div>
      `,
    },
  ],
};
