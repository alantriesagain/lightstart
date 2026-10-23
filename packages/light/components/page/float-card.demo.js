import { html } from "@bootstrapp/light/html";

const props = {
  "icon": "sparkles",
  "title": "Offline by default",
  "description": "Reads answer from the local database first, then reconcile.",
};

export default {
  description: "A card that overlaps the band above it.",
  preview: () => html`
    <div class="relative" style="height: 100px">
      <lc-float-card style="top: 16px; left: 16px"><lc-card padding="sm" shadow="md"><strong>Offline by default</strong><span class="text-sm">Reads answer locally first.</span></lc-card></lc-float-card>
    </div>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-float-card
        .icon=${props.icon}
        .title=${props.title}
        .description=${props.description}
        ></lc-float-card>
      `,
    },
  ],
};
