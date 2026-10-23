import { html } from "@bootstrapp/light/html";

const BUTTONS = `<lc-button>Default</lc-button>
<lc-button primary>Primary</lc-button>
<lc-button secondary>Secondary</lc-button>`;

const renderButtons = () => html`
  <lc-flex gap="sm">
    <lc-button>Default</lc-button>
    <lc-button primary>Primary</lc-button>
    <lc-button secondary>Secondary</lc-button>
  </lc-flex>
`;

export default {
  description: "A rendered example beside the code that produced it, with a Preview/Code switch and a device width.",
  preview: () => html`<lc-example title="Variants" description="Three buttons, three roles" .preview=${renderButtons} .code=${BUTTONS}></lc-example>`,
  previewWidth: 640,
  examples: [
    {
      title: "Preview with its code",
      render: () => html`<lc-example title="Variants" description="Three buttons, three roles" .preview=${renderButtons} .code=${BUTTONS}></lc-example>`,
    },
    {
      title: "Code first",
      render: () => html`<lc-example title="Variants" view="code" .preview=${renderButtons} .code=${BUTTONS}></lc-example>`,
    },
    {
      title: "At a device width",
      description: "The stage narrows to the width picked; the chrome around it does not.",
      render: () => html`<lc-example title="Narrow" viewports viewport="375" .preview=${renderButtons} .code=${BUTTONS}></lc-example>`,
    },
    {
      title: "Both at once",
      render: () => html`<lc-example view="both" .preview=${renderButtons} .code=${BUTTONS}></lc-example>`,
    },
  ],
};
