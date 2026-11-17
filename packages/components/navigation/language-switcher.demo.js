import { html } from "@lightstart/light/html";

const labels = { en: "English", pt: "Português" };

export default {
  description: "The languages a translation offers, with the current one selected.",
  preview: () => html`<lc-language-switcher></lc-language-switcher>`,
  examples: [
    {
      title: "Basic switcher",
      render: () => html`<lc-language-switcher></lc-language-switcher>`,
    },
    {
      title: "Custom labels",
      description: "A label per language tag overrides the name the language has in itself.",
      render: () => html`<lc-language-switcher .labels=${labels}></lc-language-switcher>`,
    },
  ],
};
