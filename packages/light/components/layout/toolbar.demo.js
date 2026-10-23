import { html } from "@bootstrapp/light/html";

export default {
  description: "A row of actions with its own spacing and overflow.",
  preview: () => html`
    <lc-toolbar variant="floating" align="center">
      <lc-button size="xs" icon="zoom-out" icon-only></lc-button>
      <lc-button size="xs">Fit</lc-button>
      <lc-button size="xs" icon="zoom-in" icon-only></lc-button>
    </lc-toolbar>
  `,
  examples: [
    {
      title: "Floating over a canvas",
      render: () => html`
        <lc-toolbar variant="floating" align="center">
          <lc-button icon="zoom-out" iconOnly></lc-button>
          <lc-button>Fit</lc-button>
          <lc-button icon="zoom-in" iconOnly></lc-button>
        </lc-toolbar>
      `,
    },
  ],
};
