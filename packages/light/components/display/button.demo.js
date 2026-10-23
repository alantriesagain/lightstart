import { html } from "@bootstrapp/light/html";

export default {
  description: "A clickable action. Colour attributes map to the theme's roles, so a skin redresses every button at once.",
  slot: () => "Click me",
  preview: () => html`
    <lc-flex gap="sm" align="center">
      <lc-button primary>Save</lc-button>
      <lc-button outline>Cancel</lc-button>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-button>Click me</lc-button>
      `,
    },
    {
      title: "Variants",
      description: "Different visual styles for various action types",
      render: () => html`
        <div class="flex gap-2 items-center flex-wrap">
         <lc-button>Default</lc-button>
         <lc-button primary>Primary</lc-button>
         <lc-button secondary>Secondary</lc-button>
         <lc-button success>Success</lc-button>
         <lc-button danger>Danger</lc-button>
        </div>
      `,
    },
    {
      title: "Styles",
      description: "Different style treatments",
      render: () => html`
        <div class="flex gap-2 items-center flex-wrap">
         <lc-button primary>Solid</lc-button>
         <lc-button danger ghost>Ghost</lc-button>
         <lc-button secondary outline>Outline</lc-button>
         <lc-button primary border>Border</lc-button>
        </div>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <div class="flex gap-2 items-center flex-wrap">
         <lc-button size="xs">Extra Small</lc-button>
         <lc-button size="sm">Small</lc-button>
         <lc-button size="md">Medium</lc-button>
         <lc-button size="lg">Large</lc-button>
         <lc-button size="xl">Extra Large</lc-button>
        </div>
      `,
    },
    {
      title: "Disabled",
      render: () => html`
        <lc-button disabled>Cannot Click</lc-button>
      `,
    },
    {
      title: "As link",
      render: () => html`
        <lc-button href="#">Go to Dashboard</lc-button>
      `,
    },
  ],
};
