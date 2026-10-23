import { html } from "@bootstrapp/light/html";

export default {
  description: "A searchable grid of every icon in the theme's set.",
  preview: () => html`
    <lc-card padding="sm">
      <div class="grid grid-cols-6 gap-2">
        ${["star", "heart", "calendar", "bell", "map", "sun", "moon", "flag", "gem", "globe", "zap", "trophy"].map((name) => html`<lc-icon name=${name} size="18" style=${name === "calendar" ? "color: var(--color-primary)" : ""}></lc-icon>`)}
      </div>
    </lc-card>
  `,
  examples: [
    {
      title: "Pick an icon",
      render: () => html`
        <lc-icon-picker value="calendar"></lc-icon-picker>
      `,
    },
  ],
};
