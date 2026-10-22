import { html } from "@bootstrapp/light/html";

const SHUTTER = ["1/8", "1/15", "1/30", "1/60", "1/125", "1/250", "1/500", "1/1000", "1/2000", "1/4000"];
const ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800];

export default {
  description: "A row of printed stops that slides under a fixed mark, the way a camera's shutter and ISO are turned.",
  preview: () => html`<lc-ruler style="width: 320px" .items=${SHUTTER} value="4" label="Shutter"></lc-ruler>`,
  examples: [
    {
      title: "Shutter speeds, two ticks between stops",
      render: () => html`<lc-ruler style="width: 320px" .items=${SHUTTER} value="4" minor="2" label="Shutter"></lc-ruler>`,
    },
    {
      title: "ISO, in whole stops",
      render: () => html`<lc-ruler style="width: 320px" .items=${ISO} value="3" minor="2" label="ISO"></lc-ruler>`,
    },
    {
      title: "Modes, no minor ticks and a wide step",
      render: () => html`<lc-ruler style="width: 320px; --lc-ruler-mark-color: #6d5cff" .items=${["A+", "P", "Av", "Tv", "M", "B"]} value="2" minor="0" step="58" label="Mode"></lc-ruler>`,
    },
    {
      title: "Disabled",
      render: () => html`<lc-ruler style="width: 320px" .items=${ISO} value="1" disabled></lc-ruler>`,
    },
  ],
};
