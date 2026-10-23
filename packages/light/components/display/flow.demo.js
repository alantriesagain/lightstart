import { html } from "@bootstrapp/light/html";

const release = [
  {
    id: "release",
    label: "Release",
    steps: [
      { id: "commit", label: "Commit" },
      { id: "test", label: "Test", detail: "unit and browser" },
      { id: "tag", label: "Tag" },
      { id: "publish", label: "Publish", detail: "npm" },
    ],
  },
];

const PHASES = ["Write", "Build", "Run"];

const paths = [
  {
    id: "web",
    label: "Browser",
    detail: "served as written",
    steps: [
      { id: "web-source", label: "app.js", phase: 0 },
      { id: "web-engine", label: "The page's engine", detail: "parses, then compiles hot code", phase: 2 },
    ],
  },
  {
    id: "bundle",
    label: "Bundled",
    detail: "one file per route",
    steps: [
      { id: "bundle-source", label: "app.ts", phase: 0 },
      { id: "bundle-strip", label: "Strip types", phase: 1 },
      { id: "bundle-join", label: "Bundle", detail: "tree-shaken", phase: 1 },
      { id: "bundle-engine", label: "The page's engine", phase: 2 },
    ],
  },
  {
    id: "native",
    label: "Native",
    detail: "ahead of time",
    steps: [
      { id: "native-source", label: "app.ts", phase: 0 },
      { id: "native-compile", label: "Compile", detail: "to machine code", phase: 1, tone: "accent" },
      { id: "native-run", label: "The executable", phase: 2 },
    ],
  },
];

export default {
  description: "Steps in lanes with arrows between them, lined up under phases to compare paths.",
  previewWidth: 220,
  preview: () => html`
    <div style="width: 220px">
      <lc-flow .lanes=${[{ id: "p", label: "Ship", steps: [{ id: "a", label: "Build" }, { id: "b", label: "Test" }, { id: "c", label: "Run" }] }]} selected="b"></lc-flow>
    </div>
  `,
  examples: [
    {
      title: "One lane",
      description: "A sequence read left to right; press a step to select it.",
      render: () => html`
        <lc-flow .lanes=${release} selected="test"></lc-flow>
      `,
    },
    {
      title: "Paths under phases",
      description: "Each lane lines up under the phase headings and draws a dashed line through a phase it skips. An accent step is the one to look at.",
      render: () => html`
        <lc-flow .phases=${PHASES} .lanes=${paths} selected="native-compile"></lc-flow>
      `,
    },
    {
      title: "Narrow",
      description: "Under 40rem the lanes stack and run top to bottom, each step naming its phase.",
      render: () => html`
        <div style="max-width: 20rem">
          <lc-flow .phases=${PHASES} .lanes=${paths.slice(2)}></lc-flow>
        </div>
      `,
    },
  ],
};
