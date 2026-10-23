import { html } from "@bootstrapp/light/html";

const props = {
  "eyebrow": "Pricing",
  "headline": "Simple, predictable pricing",
  "subheadline": "Start free, upgrade when the app needs it. No per-seat traps.",
  "plans": [
    {
      "name": "Starter",
      "price": "$0",
      "period": "/ month",
      "description": "For personal projects and experiments.",
      "features": [
        "Up to 3 projects",
        "Community support",
        "Static hosting",
      ],
      "cta": {
        "label": "Get started",
        "href": "#",
      },
      "highlighted": false,
    },
    {
      "name": "Pro",
      "price": "$19",
      "period": "/ month",
      "description": "Unlock production-ready features.",
      "features": [
        "Unlimited projects",
        "Priority support",
        "Custom domains",
        "Team collaboration",
      ],
      "cta": {
        "label": "Start Pro trial",
        "href": "#",
      },
      "highlighted": true,
    },
    {
      "name": "Team",
      "price": "$49",
      "period": "/ month",
      "description": "Scale to the whole team.",
      "features": [
        "Everything in Pro",
        "SSO and audit logs",
        "Role-based access",
        "Dedicated support",
      ],
      "cta": {
        "label": "Contact sales",
        "href": "#",
      },
      "highlighted": false,
    },
  ],
};

export default {
  description: "The plans side by side, with the recommended one lifted.",
  preview: () => html`
    <lc-pricing-table headline="Simple pricing" .plans=${[{ name: "Starter", price: "$0", period: "/ month", features: ["3 projects"], cta: { label: "Get started", href: "#" } }, { name: "Pro", price: "$19", period: "/ month", features: ["Unlimited projects"], cta: { label: "Start trial", href: "#" }, highlighted: true }]}></lc-pricing-table>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-pricing-table
        .eyebrow=${props.eyebrow}
        .headline=${props.headline}
        .subheadline=${props.subheadline}
        .plans=${props.plans}
        ></lc-pricing-table>
      `,
    },
  ],
};
