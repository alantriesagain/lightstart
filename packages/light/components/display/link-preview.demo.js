import { html } from "@bootstrapp/light/html";

export default {
  description: "A URL as a card: title, description and image, fetched from its metadata.",
  preview: () => html`<lc-link-preview url="https://example.com/article" title="An Interesting Article" description="A short summary of what the linked page is about."></lc-link-preview>`,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-link-preview
          url="https://example.com/article"
          title="An Interesting Article"
          description="A short summary of what the linked page is about, clamped to two lines."
        ></lc-link-preview>
      `,
    },
    {
      title: "Thumbnail and favicon",
      render: () => html`
        <lc-link-preview
          url="https://example.com/article"
          title="An Interesting Article"
          description="A short summary of what the linked page is about."
          image="https://picsum.photos/300/200"
          favicon="https://example.com/favicon.ico"
        ></lc-link-preview>
      `,
    },
    {
      title: "Explicit domain label",
      render: () => html`
        <lc-link-preview
          url="https://news.ycombinator.com/item?id=1"
          title="Show HN: Something"
          domain="Hacker News"
        ></lc-link-preview>
      `,
    },
  ],
};
