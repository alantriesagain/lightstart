import { html } from "@bootstrapp/light/html";

const columns = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "In progress" },
  { id: "done", title: "Done" },
];
const rows = [
  { id: "1", title: "Write the demo sidecars", status: "doing" },
  { id: "2", title: "Ship the skins", status: "done" },
  { id: "3", title: "Rework the showcase", status: "doing" },
  { id: "4", title: "Token naming sweep", status: "todo" },
];

export default {
  description: "Columns of cards a reader drags between.",
  preview: () => html`<lc-kanban .columns=${columns} .rows=${rows} group-by-field="status"></lc-kanban>`,
  previewWidth: 960,
  examples: [
    {
      title: "Three columns",
      render: () => html`
        <lc-kanban .columns=${columns} .rows=${rows} group-by-field="status"></lc-kanban>
      `,
    },
  ],
};
