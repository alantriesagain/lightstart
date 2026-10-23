import { html } from "@bootstrapp/light/html";

export default {
  description: "An image that loads lazily, keeps its aspect ratio, and has something to show while it waits.",
  preview: () => html`<lc-image src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 160 90%27%3E%3Crect width=%27160%27 height=%2790%27 fill=%27lightsteelblue%27/%3E%3Cpath d=%27M0 90 L50 40 L90 75 L120 50 L160 90Z%27 fill=%27slategray%27/%3E%3Ccircle cx=%27125%27 cy=%2725%27 r=%2710%27 fill=%27white%27/%3E%3C/svg%3E" alt="Mountains under a sun" style="display: block; width: 160px; height: 90px; border-radius: var(--radius-md, 0.5rem)"></lc-image>`,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-image
          src="https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&amp;q=80"
          alt="Rio de Janeiro from above"
        ></lc-image>
      `,
    },
    {
      title: "Nothing to load",
      description: "A missing source still holds its space rather than collapsing.",
      render: () => html`
        <lc-image alt="Nothing here"></lc-image>
      `,
    },
  ],
};
