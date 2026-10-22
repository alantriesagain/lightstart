import { html } from "@bootstrapp/light/html";

const CITIES = ["Rio de Janeiro", "São Paulo", "Recife", "Salvador"];
const columns = [
  { name: "Name" },
  { name: "City" },
  { name: "Going", align: "right" },
];
const rows = Array.from({ length: 64 }, (/** @type {unknown} */ _, index) => ({
  id: index,
  Name: `Meetup #${index + 1}`,
  City: CITIES[index % CITIES.length],
  Going: (index * 37) % 180,
}));

export default {
  description: "A table that pages, sorts and says where it is: a header click sorts, the footer names the range, the pages and how many rows a page holds.",
  preview: () => html`<lc-data-table .columns=${columns} .rows=${rows} .pageSize=${8} .pageSizes=${[8, 16, 32]}></lc-data-table>`,
  previewWidth: 640,
  examples: [
    {
      title: "Paging and sorting",
      render: () => html`<lc-data-table .columns=${columns} .rows=${rows}></lc-data-table>`,
    },
    {
      title: "Sorted to start, compact",
      render: () => html`<lc-data-table .columns=${columns} .rows=${rows} sort-by="Going" sort-dir="desc" .pageSize=${10} compact></lc-data-table>`,
    },
  ],
};
