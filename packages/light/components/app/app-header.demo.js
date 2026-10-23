import { html } from "@bootstrapp/light/html";

export default {
  description: "The header of a screen: a title, a back action and what belongs on the right.",
  slot: () => html`
    <div slot="start"><lc-icon name="menu"></lc-icon></div>
    <div slot="end"><lc-button ghost size="sm"><lc-icon name="bell"></lc-icon></lc-button></div>
  `,
  preview: () => html`
    <lc-app-header title="Messages">
      <button slot="start"><lc-icon name="menu"></lc-icon></button>
      <button slot="end"><lc-icon name="search"></lc-icon></button>
      <button slot="end"><lc-icon name="more-vertical"></lc-icon></button>
    </lc-app-header>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-app-header title="My App"></lc-app-header>
      `,
    },
    {
      title: "Actions",
      render: () => html`
        <lc-app-header title="Messages">
          <button slot="end">
            <lc-icon name="search"></lc-icon>
          </button>
          <button slot="end">
            <lc-icon name="more-vertical"></lc-icon>
          </button>
        </lc-app-header>
      `,
    },
    {
      title: "Menu button",
      render: () => html`
        <lc-app-header title="Dashboard">
          <button slot="start">
            <lc-icon name="menu"></lc-icon>
          </button>
        </lc-app-header>
      `,
    },
    {
      title: "Transparent",
      render: () => html`
        <lc-app-header
          title="Photo"
          transparent
          show-back-button
        ></lc-app-header>
      `,
    },
    {
      title: "Custom title content",
      render: () => html`
        <lc-app-header>
          <div slot="title">
            <img src="/logo.svg" alt="Logo" height="32">
          </div>
        </lc-app-header>
      `,
    },
    {
      title: "Non-fixed",
      render: () => html`
        <lc-app-header title="About" fixed="false"></lc-app-header>
      `,
    },
    {
      title: "Without shadow",
      render: () => html`
        <lc-app-header
          title="Settings"
          show-shadow="false"
        ></lc-app-header>
      `,
    },
  ],
};
