import { html } from "/app/__light-runtime__.js";

const columns = [
  { name: "name", label: "Name" },
  { name: "city", label: "City" },
  { name: "going", label: "Going" },
];
const rows = [
  { name: "Meetup Rio", city: "Rio de Janeiro", going: 132 },
  { name: "JS Sampa", city: "Sao Paulo", going: 98 },
  { name: "Belo Code", city: "Belo Horizonte", going: 47 },
];

export default {
  description: "Rows and columns with a sticky header, and an empty state when there are none.",
  preview: () => html`<lc-table .columns=${columns} .rows=${rows}></lc-table>`,
  previewWidth: 640,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-table .columns=${columns} .rows=${rows}></lc-table>
      `,
    },
    {
      title: "Sortable",
      render: () => html`
        <lc-table .columns=${columns} .rows=${rows} sortable sort-by="going" sort-dir="desc"></lc-table>
      `,
    },
    {
      title: "Empty",
      render: () => html`
        <lc-table .columns=${columns} .rows=${[]} empty-message="No events yet"></lc-table>
      `,
    },
  ],
};
