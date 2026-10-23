import { html } from "@bootstrapp/light/html";

const GROUPS = [
  {
    id: "form",
    label: "Form",
    icon: "list-checks",
    count: 5,
    items: [
      { label: "Checkbox", href: "/components/form/checkbox" },
      { label: "Input", href: "/components/form/input" },
      { label: "Select", href: "/components/form/select" },
      { label: "Switch", href: "/components/form/switch" },
      { label: "Textarea", href: "/components/form/textarea" },
    ],
  },
  {
    id: "display",
    label: "Display",
    icon: "eye",
    count: 3,
    items: [
      { label: "Badge", href: "/components/display/badge" },
      { label: "Button", href: "/components/display/button" },
      { label: "Tag", href: "/components/display/tag", badge: "new" },
    ],
  },
];

export default {
  description: "A site's sections as groups of links from data, the current route marked.",
  previewWidth: 320,
  preview: () => html`<lc-nav-tree
    .groups=${[
      { id: "form", label: "Form", icon: "list-checks", count: 3, items: [
        { label: "Checkbox", href: "#" },
        { label: "Input", href: "#" },
        { label: "Select", href: "#" },
      ] },
      { id: "display", label: "Display", icon: "eye", count: 2, items: [
        { label: "Badge", href: "#" },
        { label: "Button", href: "#" },
      ] },
    ]}
    .open=${["form"]}
    style="width: 15rem;"
  ></lc-nav-tree>`,
  examples: [
    {
      title: "Two groups, one open",
      render: () => html`<lc-nav-tree .groups=${GROUPS} .open=${["form"]} style="width: 15rem;"></lc-nav-tree>`,
    },
    {
      title: "Folded after three",
      description: "A long group shows its first items and a count of the rest.",
      render: () => html`<lc-nav-tree .groups=${GROUPS} .open=${["form", "display"]} collapse-at="3" style="width: 15rem;"></lc-nav-tree>`,
    },
    {
      title: "Active named by the page",
      render: () => html`<lc-nav-tree .groups=${GROUPS} .open=${["display"]} active="/components/display/button" style="width: 15rem;"></lc-nav-tree>`,
    },
  ],
};
