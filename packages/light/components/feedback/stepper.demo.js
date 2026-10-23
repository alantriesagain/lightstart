import { html } from "@bootstrapp/light/html";

const PUBLISH = [
  { id: "upload", label: "Upload" },
  { id: "container", label: "Prepare" },
  { id: "process", label: "Process" },
  { id: "publish", label: "Publish" },
];

const SHORT = [
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "live", label: "Live" },
];

const ONBOARDING = [
  { id: "connect", label: "Connect Instagram", description: "Paste the token from the Meta dashboard.", done: true },
  { id: "profile", label: "Pick a profile", description: "The account posts go out from.", done: true },
  { id: "first", label: "Schedule a first post", description: "Any draft, any time this week." },
  { id: "review", label: "Check the insights", description: "A day after it goes out." },
];

export default {
  description: "Where a multi-step job has got to, with the reason drawn under it when a step fails.",
  preview: () => html`
    <lc-stepper size="sm" .steps=${SHORT} current="review" state="running"></lc-stepper>
  `,
  previewWidth: 240,
  examples: [
    {
      title: "Waiting to start",
      render: () => html`
        <lc-stepper .steps=${PUBLISH} current="upload"></lc-stepper>
      `,
    },
    {
      title: "Running",
      description: "The current step spins while the earlier ones carry a check.",
      render: () => html`
        <lc-stepper .steps=${PUBLISH} current="process" state="running"></lc-stepper>
      `,
    },
    {
      title: "Done",
      render: () => html`
        <lc-stepper .steps=${PUBLISH} current="publish" state="done"></lc-stepper>
      `,
    },
    {
      title: "Failed with a reason",
      render: () => html`
        <lc-stepper
          .steps=${PUBLISH}
          current="publish"
          state="failed"
          error="The media URL did not answer, so the post was not published."
        ></lc-stepper>
      `,
    },
    {
      title: "Vertical, with descriptions",
      description: "A column of rings: filled with a check once done, in ink for the current step, a hairline while it waits.",
      render: () => html`
        <div style="max-width:320px">
          <lc-stepper vertical .steps=${ONBOARDING} current="first"></lc-stepper>
        </div>
      `,
    },
    {
      title: "Small",
      render: () => html`
        <lc-stepper size="sm" .steps=${SHORT} current="review" state="running"></lc-stepper>
      `,
    },
  ],
};
