import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.sections.find((section) => section.type === "lc-testimonial-section")?.props ?? {};

export default {
  description: "What people said, with their names and faces.",
  preview: () => html`
    <lc-testimonial-section headline="Loved by developers" .testimonials=${[{ quote: "Our pages load instantly now.", author: "Sarah Chen", role: "Frontend lead", avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='lightsteelblue'/%3E%3Ccircle cx='20' cy='16' r='7' fill='white'/%3E%3C/svg%3E", rating: 5 }, { quote: "Our existing styles just work.", author: "Marcus Rivera", role: "Staff engineer", avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='lightsteelblue'/%3E%3Ccircle cx='20' cy='16' r='7' fill='white'/%3E%3C/svg%3E", rating: 5 }]}></lc-testimonial-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-testimonial-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .testimonials=${props.testimonials}
        ></lc-testimonial-section>
      `,
    },
  ],
};
