import { html } from "@bootstrapp/light/html";

export default {
  description: "A vertical list of links, as a sidebar or a popup.",
  slot: () => html`
    <lc-nav-item label="Menu Item 1"></lc-nav-item>
    <lc-nav-item label="Menu Item 2"></lc-nav-item>
    <lc-nav-item label="Menu Item 3"></lc-nav-item>
  `,
  preview: () => html`
    <lc-menu variant="bordered">
      <li role="menuitem"><a href="#"><lc-icon name="user"></lc-icon> Profile</a></li>
      <li role="menuitem"><a href="#"><lc-icon name="settings"></lc-icon> Settings</a></li>
      <li role="menuitem"><a href="#"><lc-icon name="log-out"></lc-icon> Logout</a></li>
    </lc-menu>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-menu>
          <li role="menuitem"><a href="#home">Home</a></li>
          <li role="menuitem"><a href="#about">About</a></li>
          <li role="menuitem"><a href="#services">Services</a></li>
          <li role="menuitem"><a href="#contact">Contact</a></li>
        </lc-menu>
      `,
    },
    {
      title: "Icons",
      render: () => html`
        <lc-menu>
          <li role="menuitem">
            <a href="#profile">
              <lc-icon name="user"></lc-icon>
              Profile
            </a>
          </li>
          <li role="menuitem">
            <a href="#settings">
              <lc-icon name="settings"></lc-icon>
              Settings
            </a>
          </li>
          <li role="menuitem">
            <a href="#help">
              <lc-icon name="circle-help"></lc-icon>
              Help
            </a>
          </li>
          <li role="separator" class="divider"></li>
          <li role="menuitem">
            <a href="#logout">
              <lc-icon name="log-out"></lc-icon>
              Logout
            </a>
          </li>
        </lc-menu>
      `,
    },
    {
      title: "Bordered variant",
      render: () => html`
        <lc-menu variant="bordered">
          <li role="menuitem"><a href="#dashboard">Dashboard</a></li>
          <li role="menuitem"><a href="#reports">Reports</a></li>
          <li role="menuitem"><a href="#analytics">Analytics</a></li>
        </lc-menu>
      `,
    },
    {
      title: "Compact variant",
      render: () => html`
        <lc-menu variant="compact" size="sm">
          <li role="menuitem"><a href="#item1">Item 1</a></li>
          <li role="menuitem"><a href="#item2">Item 2</a></li>
          <li role="menuitem"><a href="#item3">Item 3</a></li>
        </lc-menu>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; gap: 2rem;">
          <lc-menu size="sm">
            <li role="menuitem"><a href="#">Small</a></li>
            <li role="menuitem"><a href="#">Menu</a></li>
          </lc-menu>

          <lc-menu size="md">
            <li role="menuitem"><a href="#">Medium</a></li>
            <li role="menuitem"><a href="#">Menu</a></li>
          </lc-menu>

          <lc-menu size="lg">
            <li role="menuitem"><a href="#">Large</a></li>
            <li role="menuitem"><a href="#">Menu</a></li>
          </lc-menu>
        </div>
      `,
    },
    {
      title: "In a dropdown",
      render: () => html`
        <lc-button popovertarget="actions-menu">Actions</lc-button>
        <lc-dropdown id="actions-menu">
          <a href="#edit">Edit</a>
          <a href="#duplicate">Duplicate</a>
          <a href="#archive">Archive</a>
          <hr>
          <a href="#delete" class="text-error">Delete</a>
        </lc-dropdown>
      `,
    },
    {
      title: "Nested submenus",
      render: () => html`
        <lc-menu>
          <li role="menuitem"><a href="#home">Home</a></li>
          <li role="menuitem">
            <details>
              <summary>Products</summary>
              <ul>
                <li><a href="#laptops">Laptops</a></li>
                <li><a href="#phones">Phones</a></li>
                <li><a href="#tablets">Tablets</a></li>
              </ul>
            </details>
          </li>
          <li role="menuitem"><a href="#about">About</a></li>
        </lc-menu>
      `,
    },
    {
      title: "Active state",
      render: () => html`
        <lc-menu>
          <li role="menuitem"><a href="#dashboard">Dashboard</a></li>
          <li role="menuitem"><a href="#projects" class="active">Projects</a></li>
          <li role="menuitem"><a href="#team">Team</a></li>
          <li role="menuitem"><a href="#settings">Settings</a></li>
        </lc-menu>
      `,
    },
  ],
};
