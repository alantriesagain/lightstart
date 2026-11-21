import { html } from "@lightstart/light/html";
/** @import { CommandPaletteElement } from "../types.ts" */

const DOCS = [
  { id: "button", group: "Components", title: "Button", hint: "Display", href: "/components/display/button" },
  { id: "switch", group: "Components", title: "Switch", hint: "Form", href: "/components/form/switch" },
  { id: "swipe-deck", group: "Components", title: "Swipe deck", hint: "App shell", href: "/components/app/swipe-deck" },
  { id: "skins", group: "Pages", title: "Skins", hint: "The presets side by side", href: "/skins" },
  { id: "theming", group: "Pages", title: "Theming", hint: "The token contract", href: "/theming" },
];

export default {
  description: "A search over the app's places, opened by a shortcut or its own trigger, in a dialog that names its keys.",
  preview: () => html`<lc-command-palette placeholder="Search"></lc-command-palette>`,
  examples: [
    {
      title: "Trigger and shortcut",
      description: "Press the shortcut anywhere on the page, or click the field.",
      render: () => html`<lc-command-palette .docs=${DOCS} .groups=${["Components", "Pages"]}></lc-command-palette>`,
    },
    {
      title: "Suggestions before typing",
      render: () => html`<lc-command-palette .docs=${DOCS} .suggestions=${DOCS.slice(3)} .groups=${["Components", "Pages"]} shortcut="mod+/"></lc-command-palette>`,
    },
    {
      title: "Opened by something else",
      description: "Without its trigger, another control sets `open`.",
      render: () => html`
        <lc-command-palette id="palette-demo" .docs=${DOCS} .groups=${["Components", "Pages"]} hide-trigger></lc-command-palette>
        <lc-button @click=${OPEN_PALETTE}>Search</lc-button>
      `,
    },
    {
      title: "Anchored under a field",
      description: "`anchor` names the field; the panel opens below it as a floating layer, without a backdrop.",
      render: () => html`
        <input id="palette-anchor-demo" placeholder="Search the app" style="width: 320px; height: 2.25rem; padding: 0 0.75rem; font: inherit;" />
        <lc-command-palette id="palette-anchored-demo" hide-trigger anchor="palette-anchor-demo" .docs=${DOCS} .groups=${["Components", "Pages"]}></lc-command-palette>
        <lc-button @click=${OPEN_ANCHORED_PALETTE}>Search</lc-button>
      `,
    },
  ],
};

const OPEN_PALETTE = () => {
  const palette = /** @type {CommandPaletteElement | null} */ (document.getElementById("palette-demo"));
  if (palette) palette.open = true;
};

const OPEN_ANCHORED_PALETTE = () => {
  const palette = /** @type {CommandPaletteElement | null} */ (document.getElementById("palette-anchored-demo"));
  if (palette) palette.open = true;
};
