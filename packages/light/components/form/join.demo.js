import { html } from "@bootstrapp/light/html";

export default {
  description: "Buttons or inputs fused into one control, with the corners rounded only on the ends.",
  slot: () => html`
    <lc-button>Left</lc-button>
    <lc-button>Center</lc-button>
    <lc-button>Right</lc-button>
  `,
  preview: () => html`
    <lc-join>
      <lc-input size="sm" placeholder="Search..."></lc-input>
      <lc-button size="sm" variant="primary">Go</lc-button>
    </lc-join>
  `,
  examples: [
    {
      title: "Button group",
      render: () => html`
        <lc-join>
          <lc-button>Button 1</lc-button>
          <lc-button>Button 2</lc-button>
          <lc-button>Button 3</lc-button>
        </lc-join>
      `,
    },
    {
      title: "Input with button",
      render: () => html`
        <lc-join>
          <lc-input placeholder="Search..."></lc-input>
          <lc-button variant="primary">Search</lc-button>
        </lc-join>
      `,
    },
    {
      title: "A pill that paints itself, holding a popover",
      render: () => html`
        <lc-join style="--lc-join-border-radius:9999px;--lc-join-background:rgba(255,255,255,0.82);--lc-join-backdrop:blur(22px);--lc-join-overflow:visible">
          <a href="#">meetup.rio</a>
          <lc-search collapsible></lc-search>
        </lc-join>
      `,
    },
    {
      title: "Vertical orientation",
      render: () => html`
        <lc-join orientation="vertical">
          <lc-button>Top</lc-button>
          <lc-button>Middle</lc-button>
          <lc-button>Bottom</lc-button>
        </lc-join>
      `,
    },
    {
      title: "Mixed components",
      render: () => html`
        <lc-join>
          <lc-select options='["Option 1", "Option 2"]'></lc-select>
          <lc-input placeholder="Value"></lc-input>
          <lc-button variant="primary">Submit</lc-button>
        </lc-join>
      `,
    },
  ],
};
