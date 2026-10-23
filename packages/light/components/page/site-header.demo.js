import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.header.props;

export default {
  description: "A marketing site's header, with navigation and a call to action.",
  preview: () => html`
    <lc-site-header .brand=${{ name: "Bootstrapp", href: "#" }} .links=${[{ label: "Features", href: "#" }, { label: "Pricing", href: "#" }, { label: "FAQ", href: "#" }]} .actions=${[{ label: "Get started", href: "#", variant: "primary" }]}></lc-site-header>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-site-header
        .brand=${props.brand}
        .links=${props.links}
        .actions=${props.actions}
        ></lc-site-header>
      `,
    },
  ],
};
