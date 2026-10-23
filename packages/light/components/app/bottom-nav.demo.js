import { html } from "@bootstrapp/light/html";

export default {
  description: "The bar along the bottom of a phone app, with a raised centre action when asked.",
  slot: () => html`
    <lc-nav-item icon="house" label="Home"></lc-nav-item>
    <lc-nav-item icon="search" label="Search"></lc-nav-item>
    <lc-nav-item icon="user" label="Profile"></lc-nav-item>
  `,
  preview: () => html`
    <lc-bottom-nav>
      <a href="#" class="active"><lc-icon name="house"></lc-icon><span>Home</span></a>
      <a href="#"><lc-icon name="search"></lc-icon><span>Search</span></a>
      <a href="#"><lc-icon name="heart"></lc-icon><span>Favorites</span></a>
      <a href="#"><lc-icon name="user"></lc-icon><span>Profile</span></a>
    </lc-bottom-nav>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "The dock: a nav that becomes the action",
      render: () => html`
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center">
          <lc-bottom-nav variant="dock" style="--lc-bottom-nav-background:#1f1a17;--lc-bottom-nav-item-active-background:#fbef76;--lc-bottom-nav-item-active-color:#1f1a17">
            <lc-nav-item icon="calendar-days" label="Today" active activeBg></lc-nav-item>
            <lc-nav-item icon="map" label="Map" icon-only></lc-nav-item>
            <lc-nav-item icon="heart" label="Saved" icon-only></lc-nav-item>
            <lc-avatar name="You" size="sm"></lc-avatar>
          </lc-bottom-nav>
          <lc-bottom-nav variant="dock" style="--lc-bottom-nav-background:#1f1a17;--lc-bottom-nav-item-active-background:#fbef76;--lc-bottom-nav-item-active-color:#1f1a17">
            <lc-nav-item icon="calendar-days" label="Today" collapsed></lc-nav-item>
            <button type="button" primary><lc-icon name="check" size="18"></lc-icon> Going</button>
            <lc-nav-item icon="heart" label="Saved" collapsed></lc-nav-item>
            <lc-avatar name="You" size="sm" collapsed></lc-avatar>
          </lc-bottom-nav>
        </div>
      `,
    },
    {
      title: "Basic navigation",
      render: () => html`
        <lc-bottom-nav>
          <a href="#">
            <lc-icon name="house"></lc-icon>
            <span>Home</span>
          </a>
          <a href="#">
            <lc-icon name="search"></lc-icon>
            <span>Search</span>
          </a>
          <a href="#">
            <lc-icon name="heart"></lc-icon>
            <span>Favorites</span>
          </a>
          <a href="#">
            <lc-icon name="user"></lc-icon>
            <span>Profile</span>
          </a>
        </lc-bottom-nav>
      `,
    },
    {
      title: "Badges",
      render: () => html`
        <lc-bottom-nav>
          <a href="#">
            <lc-icon name="house"></lc-icon>
            <span>Home</span>
          </a>
          <a href="#">
            <lc-badge>3</lc-badge>
            <lc-icon name="bell"></lc-icon>
            <span>Notifications</span>
          </a>
          <a href="#">
            <lc-badge>12</lc-badge>
            <lc-icon name="message-circle"></lc-icon>
            <span>Messages</span>
          </a>
          <a href="#">
            <lc-icon name="user"></lc-icon>
            <span>Profile</span>
          </a>
        </lc-bottom-nav>
      `,
    },
    {
      title: "Floating variant",
      render: () => html`
        <lc-bottom-nav variant="floating">
          <a href="#">
            <lc-icon name="house"></lc-icon>
            <span>Home</span>
          </a>
          <a href="#">
            <lc-icon name="search"></lc-icon>
            <span>Explore</span>
          </a>
          <a href="#">
            <lc-icon name="plus"></lc-icon>
            <span>Create</span>
          </a>
          <a href="#">
            <lc-icon name="user"></lc-icon>
            <span>Profile</span>
          </a>
        </lc-bottom-nav>
      `,
    },
    {
      title: "Icons only",
      render: () => html`
        <lc-bottom-nav>
          <a href="#" aria-label="Home">
            <lc-icon name="house"></lc-icon>
          </a>
          <a href="#" aria-label="Search">
            <lc-icon name="search"></lc-icon>
          </a>
          <a href="#" aria-label="Saved">
            <lc-icon name="bookmark"></lc-icon>
          </a>
          <a href="#" aria-label="Settings">
            <lc-icon name="settings"></lc-icon>
          </a>
        </lc-bottom-nav>
      `,
    },
    {
      title: "Filled variant",
      render: () => html`
        <lc-bottom-nav variant="filled">
          <a href="#">
            <lc-icon name="grid"></lc-icon>
            <span>Dashboard</span>
          </a>
          <a href="#">
            <lc-icon name="shopping-cart"></lc-icon>
            <span>Shop</span>
          </a>
          <a href="#">
            <lc-icon name="heart"></lc-icon>
            <span>Wishlist</span>
          </a>
          <a href="#">
            <lc-icon name="user"></lc-icon>
            <span>Account</span>
          </a>
        </lc-bottom-nav>
      `,
    },
    {
      title: "Non-fixed position",
      render: () => html`
        <lc-bottom-nav fixed="false">
          <a href="#"><lc-icon name="house"></lc-icon><span>Home</span></a>
          <a href="#"><lc-icon name="search"></lc-icon><span>Search</span></a>
          <a href="#"><lc-icon name="user"></lc-icon><span>Profile</span></a>
        </lc-bottom-nav>
      `,
    },
  ],
};
