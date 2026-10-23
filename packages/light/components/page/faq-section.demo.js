import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-faq-section")?.props ?? {};

export default {
  description: "Questions and answers as an accordion.",
  preview: () => html`
    <lc-faq-section headline="Questions" .items=${[{ question: "Is it open source?", answer: "Yes, and developed in the open." }, { question: "Does it need a build step?", answer: "No, it runs on native ES modules." }]}></lc-faq-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-faq-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .items=${props.items}
        ></lc-faq-section>
      `,
    },
  ],
};
