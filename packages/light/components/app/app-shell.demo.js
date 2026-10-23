import { html } from "@bootstrapp/light/html";

export default {
  description: "Header, content and navigation assembled into one screen.",
  preview: () => html`
    <div style="height: 240px; overflow: hidden; background: var(--color-surface)">
      <lc-app-header title="Docs"></lc-app-header>
      <lc-flex style="height: 184px">
        <lc-panel variant="bordered" padding="sm" style="width: 200px">
          <lc-flex direction="column" gap="sm"><lc-text size="sm" weight="semibold">Getting started</lc-text><lc-text size="sm" muted>Components</lc-text><lc-text size="sm" muted>Theming</lc-text></lc-flex>
        </lc-panel>
        <lc-flex direction="column" gap="sm" class="p-4" style="flex: 1"><lc-text size="xl" weight="bold">Getting started</lc-text><lc-text muted>Header, navigation, content and aside in one screen.</lc-text></lc-flex>
        <lc-panel variant="bordered" padding="sm" style="width: 180px"><lc-text size="sm" muted>On this page</lc-text></lc-panel>
      </lc-flex>
    </div>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic auto-responsive",
      render: () => html`
        <lc-app-shell breakpoint="lg">
          <header slot="header">Mobile Header</header>
          <lc-navbar slot="navbar">Desktop Nav</lc-navbar>
          <div>Main Content</div>
          <footer slot="footer">Desktop Footer</footer>
          <nav slot="bottom-nav">Mobile Nav</nav>
        </lc-app-shell>
      `,
    },
    {
      title: "Documentation layout",
      description: "A nav column and an aside beside the content; on a phone the nav waits in a drawer behind the menu button.",
      render: () => html`
        <lc-app-shell layout="desktop" nav-width="12rem" aside-width="10rem" style="min-height: 16rem;">
          <lc-navbar slot="navbar">Docs</lc-navbar>
          <nav slot="nav" style="padding: 1rem;">Sections</nav>
          <div style="padding: 1rem;">The page</div>
          <aside slot="aside" style="padding: 1rem;">On this page</aside>
        </lc-app-shell>
      `,
    },
    {
      title: "Phone with a drawer",
      render: () => html`
        <lc-app-shell layout="mobile" style="min-height: 12rem;">
          <span slot="header">Docs</span>
          <nav slot="nav" style="padding: 1rem;">Sections</nav>
          <div style="padding: 1rem;">The page</div>
        </lc-app-shell>
      `,
    },
  ],
};
