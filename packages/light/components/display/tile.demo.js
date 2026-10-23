import { html } from "@bootstrapp/light/html";

export default {
  description: "A square target with an icon and a label, for a grid of destinations.",
  preview: () => html`
    <lc-flex gap="sm">
      <lc-tile size="sm" aspect="16/9" icon="file-text" label="notes.md" badge="MD"></lc-tile>
      <lc-tile size="sm" aspect="16/9" icon="image" label="cover.jpg" badge="JPG"></lc-tile>
    </lc-flex>
  `,
  examples: [
    {
      title: "A media file",
      render: () => html`
        <lc-tile src="/media/cover.jpg" label="lisbon-night.jpg" meta="4:5 · 2.1 MB" badge="JPG" interactive></lc-tile>
      `,
    },
    {
      title: "A drawn cover and a portrait aspect",
      render: () => html`
        <lc-tile aspect="9/16" label="Agent demo reel" meta="Video · 9:16">
          <div slot="media" style="width: 100%; height: 100%; background: linear-gradient(160deg, #1d2a44, #0f1526)"></div>
        </lc-tile>
      `,
    },
  ],
};
