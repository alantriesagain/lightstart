import { html } from "@bootstrapp/light/html";

export default {
  description: "A menu anchored to whatever opened it, closing on a click outside.",
  slot: () => html`
    <lc-menu>
      <lc-nav-item label="Option 1"></lc-nav-item>
      <lc-nav-item label="Option 2"></lc-nav-item>
      <lc-nav-item label="Option 3"></lc-nav-item>
    </lc-menu>
  `,
  preview: () => html`
    <div class="flex flex-col gap-1 items-start">
      <lc-button size="xs">Options <lc-icon name="chevron-down"></lc-icon></lc-button>
      <lc-menu size="sm"><lc-nav-item icon="user" label="Profile" size="sm"></lc-nav-item><lc-nav-item icon="log-out" label="Logout" size="sm"></lc-nav-item></lc-menu>
    </div>
  `,
  examples: [
    {
      title: "With a native popover trigger",
      render: () => html`
        <lc-button popovertarget="menu5">Toggle Menu</lc-button>
        <lc-dropdown id="menu5" bordered rounded shadow>
          <div class="dropdown-header">Settings</div>
          <a href="#">Profile</a>
          <hr>
          <a href="#">Logout</a>
        </lc-dropdown>
      `,
    },
  ],
};
