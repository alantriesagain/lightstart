import { html } from "@bootstrapp/light/html";

const PHOTO = "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&q=70";

export default {
  description: "An image at a fixed aspect with a scrim, a corner badge, a title over it and meta text under it.",
  preview: () => html`
    <lc-media-card src=${PHOTO} alt="Rio de Janeiro from above" style="width:72px">
      <lc-badge slot="top" size="xs">Reel</lc-badge>
    </lc-media-card>
  `,
  examples: [
    {
      title: "Badge, title and meta",
      render: () => html`
        <lc-media-card src=${PHOTO} alt="Rio de Janeiro from above" style="width:240px">
          <lc-badge slot="top" soft dot variant="success">Published</lc-badge>
          <strong slot="bottom">Sunset run at Arpoador</strong>
          <lc-text size="sm" muted>12.4K reach · 3 days ago</lc-text>
        </lc-media-card>
      `,
    },
    {
      title: "Square, without the scrim",
      render: () => html`
        <lc-media-card src=${PHOTO} alt="Rio de Janeiro from above" aspect="1/1" .scrim=${false} style="width:200px">
          <lc-text size="sm">Cover image</lc-text>
        </lc-media-card>
      `,
    },
  ],
};
