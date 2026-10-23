import { html } from "@bootstrapp/light/html";

export default {
  description: "The trail back up, with the current page as the last, unlinked step.",
  slot: () => html`
    <a href="#">Home</a>
    <a href="#">Products</a>
    <span>Current Page</span>
  `,
  preview: () => html`
    <lc-breadcrumbs size="sm">
      <a href="#">Home</a>
      <a href="#">Docs</a>
      <span>Tabs</span>
    </lc-breadcrumbs>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-breadcrumbs>
          <a href="#">Home</a>
          <a href="#">Products</a>
          <span>Laptop</span>
        </lc-breadcrumbs>
      `,
    },
    {
      title: "Different separators",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-breadcrumbs separator="/">
            <a href="#">Home</a>
            <a href="#">Docs</a>
            <span>Components</span>
          </lc-breadcrumbs>

          <lc-breadcrumbs separator="&gt;">
            <a href="#">Home</a>
            <a href="#">Docs</a>
            <span>Components</span>
          </lc-breadcrumbs>

          <lc-breadcrumbs separator="→">
            <a href="#">Home</a>
            <a href="#">Docs</a>
            <span>Components</span>
          </lc-breadcrumbs>

          <lc-breadcrumbs separator="·">
            <a href="#">Home</a>
            <a href="#">Docs</a>
            <span>Components</span>
          </lc-breadcrumbs>
        </div>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <lc-breadcrumbs size="sm">
            <a href="#">Home</a>
            <a href="#">Products</a>
            <span>Item</span>
          </lc-breadcrumbs>

          <lc-breadcrumbs size="md">
            <a href="#">Home</a>
            <a href="#">Products</a>
            <span>Item</span>
          </lc-breadcrumbs>

          <lc-breadcrumbs size="lg">
            <a href="#">Home</a>
            <a href="#">Products</a>
            <span>Item</span>
          </lc-breadcrumbs>
        </div>
      `,
    },
    {
      title: "Icons",
      render: () => html`
        <lc-breadcrumbs>
          <a href="#">
            <lc-icon name="house"></lc-icon>
            Home
          </a>
          <a href="#">
            <lc-icon name="settings"></lc-icon>
            Settings
          </a>
          <span>
            <lc-icon name="user"></lc-icon>
            Profile
          </span>
        </lc-breadcrumbs>
      `,
    },
    {
      title: "Deep navigation",
      render: () => html`
        <lc-breadcrumbs>
          <a href="#">Home</a>
          <a href="#">Documentation</a>
          <a href="#">Components</a>
          <a href="#">Navigation</a>
          <span>Breadcrumbs</span>
        </lc-breadcrumbs>
      `,
    },
  ],
};
