import { html } from "@bootstrapp/light/html";

const props = {
  "name": "Starter",
  "price": "$0",
  "period": "/ forever",
  "description": "Everything you need to ship a small project.",
  "features": [
    "Unlimited projects",
    "Built-in component library",
    "Offline-first data sync",
    "Community support",
  ],
  "cta": {
    "label": "Get started",
    "href": "#",
  },
};

export default {
  description: "One plan: its price, what is in it and the button.",
  preview: () => html`
    <lc-pricing-card name="Pro" price="$19" period="/ month" .features=${["Unlimited projects", "Priority support"]} .cta=${{ label: "Start trial", href: "#" }}></lc-pricing-card>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-pricing-card
        .name=${props.name}
        .price=${props.price}
        .period=${props.period}
        .description=${props.description}
        .features=${props.features}
        .cta=${props.cta}
        ></lc-pricing-card>
      `,
    },
  ],
};
