import { html } from "@bootstrapp/light/html";

const props = {
  "eyebrow": "Showcase",
  "headline": "Built for real work",
  "subheadline": "From dashboards to full static sites, on the same component definitions.",
  "body": "Ship pages as fast as you can design them. The editor, the preview and the publish pipeline all read the same definitions.",
  "image": {
    "src": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
    "alt": "Code on a laptop screen",
  },
  "align": "left",
  "ctas": [
    {
      "label": "See examples",
      "href": "#",
      "variant": "primary",
    },
    {
      "label": "Read the docs",
      "href": "#",
      "variant": "secondary",
    },
  ],
};

export default {
  description: "A band that shows the product itself, in a frame.",
  preview: () => html`
    <lc-showcase-section eyebrow="Showcase" headline="Built for real work" body="The editor, the preview and the publish pipeline read the same definitions." .image=${{ src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'%3E%3Crect width='160' height='100' fill='lightsteelblue'/%3E%3Crect x='16' y='16' width='80' height='10' rx='5' fill='white'/%3E%3Crect x='16' y='36' width='128' height='48' rx='6' fill='aliceblue'/%3E%3C/svg%3E", alt: "" }} .ctas=${[{ label: "See examples", href: "#", variant: "primary" }]}></lc-showcase-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-showcase-section
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .body=${props.body}
        .image=${props.image}
        .align=${props.align}
        .ctas=${props.ctas}
        ></lc-showcase-section>
      `,
    },
  ],
};
