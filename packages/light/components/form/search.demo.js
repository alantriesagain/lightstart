import { html } from "@bootstrapp/light/html";

const docs = [
  { id: "1", title: "Button", group: "Display", description: "A clickable action" },
  { id: "2", title: "Badge", group: "Display", description: "A short status" },
  { id: "3", title: "Input", group: "Form", description: "A single-line value" },
  { id: "4", title: "Select", group: "Form", description: "A dropdown of options" },
];

export default {
  description: "A search box that opens a result list under it, grouped and keyboard-navigable.",
  preview: () => html`
    <lc-flex direction="column" gap="xs">
      <lc-search placeholder="Search components" .docs=${docs}></lc-search>
      <lc-card padding="sm">
        <lc-menu>
          <li role="menuitem"><a href="#">Button</a></li>
          <li role="menuitem"><a href="#">Badge</a></li>
        </lc-menu>
      </lc-card>
    </lc-flex>
  `,
  examples: [
    {
      title: "Over a document set",
      render: () => html`
        <lc-search placeholder="Search components" .docs=${docs}></lc-search>
      `,
    },
    {
      title: "Grouped results",
      render: () => html`
        <lc-search placeholder="Search" .docs=${docs} .groups=${["Display", "Form"]} open></lc-search>
      `,
    },
  ],
};
