import { html } from "@bootstrapp/light/html";
import sample from "./sample-bootstrapp.js";

const props = sample.footer.props;

export default {
  description: "The end of a page: link columns, a note and the social row.",
  preview: () => html`
    <lc-footer .brand=${{ name: "Bootstrapp" }} tagline="The lightweight frontend framework." .columns=${[{ title: "Product", links: [{ label: "Features", href: "#" }, { label: "Pricing", href: "#" }] }, { title: "Company", links: [{ label: "About", href: "#" }, { label: "Contact", href: "#" }] }]} copyright="2026 Bootstrapp"></lc-footer>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-footer
        .brand=${props.brand}
        .tagline=${props.tagline}
        .columns=${props.columns}
        .copyright=${props.copyright}
        .socials=${props.socials ?? []}
        ></lc-footer>
      `,
    },
  ],
};
