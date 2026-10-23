import { html } from "@bootstrapp/light/html";

const items = [
  { label: "Open", icon: "external-link" },
  { label: "Rename", icon: "pencil" },
  { separator: true },
  { label: "Delete", icon: "trash", variant: "danger" },
];

export default {
  description: "The menu a right-click opens, anchored where it happened.",
  preview: () => html`
    <div class="flex gap-2 items-start">
      <lc-card padding="sm" border-style="dashed"><lc-text size="xs" muted>Right-click</lc-text></lc-card>
      <lc-menu size="sm"><lc-nav-item icon="pencil" label="Rename" size="sm"></lc-nav-item><lc-nav-item icon="trash" label="Delete" size="sm"></lc-nav-item></lc-menu>
    </div>
  `,
  examples: [
    {
      title: "Right-click a target",
      render: () => html`
        <lc-context-menu .items=${items}>
          <lc-card padding="lg">Right-click anywhere in this card.</lc-card>
        </lc-context-menu>
      `,
    },
  ],
};
