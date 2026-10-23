import { html } from "@bootstrapp/light/html";

const OCEAN = ["#1b262c", "#0f4c75", "#3282b8", "#bbe1fa"];
const CANDY = ["#364f6b", "#3fc1c9", "#f5f5f5", "#fc5185"];
const SAND = ["#8d7b68", "#a4907c", "#c8b6a6", "#f1dec9"];
const MINT = ["#e4f9f5", "#30e3ca", "#11999e", "#40514e"];

export default {
  description: "A colour palette as one row of stripes, with a label and a count under it, selectable as a button.",
  preview: () => html`
    <lc-flex direction="column" gap="sm" style="width: 96px">
      <lc-palette size="sm" .colors=${OCEAN}></lc-palette>
      <lc-palette size="sm" .colors=${CANDY} selected></lc-palette>
    </lc-flex>
  `,
  examples: [
    {
      title: "A grid to pick from",
      description: "Each palette is a button; the chosen one carries the ring.",
      render: () => html`
        <div style="display: grid; grid-template-columns: repeat(4, 120px); gap: 10px">
          <lc-palette interactive .colors=${OCEAN} meta="36k"></lc-palette>
          <lc-palette interactive selected .colors=${CANDY} label="Selected" meta="27k"></lc-palette>
          <lc-palette interactive .colors=${SAND} meta="29k"></lc-palette>
          <lc-palette interactive .colors=${MINT} meta="22k"></lc-palette>
        </div>
      `,
    },
    {
      title: "Small, without a line",
      render: () => html`
        <div style="width: 160px">
          <lc-palette size="sm" .colors=${["#f38181", "#fce38a", "#eaffd0", "#95e1d3", "#6096b4"]}></lc-palette>
        </div>
      `,
    },
  ],
};
