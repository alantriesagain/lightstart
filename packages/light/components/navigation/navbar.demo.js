import { html } from "@bootstrapp/light/html";

export default {
  description: "The bar across the top of an app, with a brand, links and actions.",
  slot: () => html`
    <div slot="brand"><lc-text weight="bold">Brand</lc-text></div>
    <div slot="center">
      <lc-link>Home</lc-link>
      <lc-link>About</lc-link>
      <lc-link>Contact</lc-link>
    </div>
    <div slot="end">
      <lc-button size="sm" variant="primary">Sign In</lc-button>
    </div>
  `,
  previewWidth: 640,
  preview: () => html`
    <lc-navbar>
      <div slot="brand"><strong>MyApp</strong></div>
      <div slot="start">
        <a href="#">Home</a>
        <a href="#">Pricing</a>
        <a href="#">Docs</a>
      </div>
      <div slot="end"><lc-button variant="primary" size="sm">Sign Up</lc-button></div>
    </lc-navbar>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-navbar>
          <div slot="brand">
            <strong>MyApp</strong>
          </div>
          <div slot="start">
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#services">Services</a>
          </div>
          <div slot="end">
            <lc-button variant="primary" size="sm">Sign Up</lc-button>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Logo",
      render: () => html`
        <lc-navbar>
          <div slot="brand">
            <img src="/logo.svg" alt="Logo" style="height: 2rem;">
          </div>
          <div slot="start">
            <a href="#products">Products</a>
            <a href="#pricing">Pricing</a>
            <a href="#docs">Docs</a>
          </div>
          <div slot="end">
            <a href="#login">Login</a>
            <lc-button variant="primary">Get Started</lc-button>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Fixed to top",
      render: () => html`
        <lc-navbar fixed="top">
          <div slot="brand">
            <strong>Fixed Top</strong>
          </div>
          <div slot="center">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#contact">Contact</a>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Fixed to bottom",
      render: () => html`
        <lc-navbar fixed="bottom">
          <div slot="center">
            <a href="#home"><lc-icon name="house"></lc-icon> Home</a>
            <a href="#search"><lc-icon name="search"></lc-icon> Search</a>
            <a href="#profile"><lc-icon name="user"></lc-icon> Profile</a>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Bordered variant",
      render: () => html`
        <lc-navbar variant="bordered">
          <div slot="brand">MyApp</div>
          <div slot="start">
            <a href="#dashboard">Dashboard</a>
            <a href="#projects">Projects</a>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Floating variant",
      render: () => html`
        <lc-navbar variant="floating">
          <div slot="brand">MyApp</div>
          <div slot="center">
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Transparent",
      render: () => html`
        <lc-navbar transparent>
          <div slot="brand" style="color: white;">
            <strong>Transparent Nav</strong>
          </div>
          <div slot="end">
            <lc-button ghost>Login</lc-button>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Dropdown menu",
      render: () => html`
        <lc-navbar>
          <div slot="brand">MyApp</div>
          <div slot="start">
            <a href="#home">Home</a>
            <lc-button popovertarget="products-menu">
              Products <lc-icon name="chevron-down"></lc-icon>
            </lc-button>
            <lc-dropdown id="products-menu">
              <a href="#product1">Product 1</a>
              <a href="#product2">Product 2</a>
              <a href="#product3">Product 3</a>
            </lc-dropdown>
          </div>
          <div slot="end">
            <lc-avatar popovertarget="user-menu" size="sm" initials="JD"></lc-avatar>
            <lc-dropdown id="user-menu">
              <a href="#profile">Profile</a>
              <a href="#settings">Settings</a>
              <a href="#logout">Logout</a>
            </lc-dropdown>
          </div>
        </lc-navbar>
      `,
    },
    {
      title: "Search",
      render: () => html`
        <lc-navbar>
          <div slot="brand">MyApp</div>
          <div slot="center">
            <lc-input
              type="search"
              placeholder="Search..."
              size="sm"
              style="width: 300px;"
            ></lc-input>
          </div>
          <div slot="end">
            <lc-button ghost size="sm">
              <lc-icon name="bell"></lc-icon>
            </lc-button>
          </div>
        </lc-navbar>
      `,
    },
  ],
};
