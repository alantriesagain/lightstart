import { html } from "@bootstrapp/light/html";

export default {
  description: "The app's side navigation, collapsible to icons.",
  slot: () => html`
    <div slot="header"><lc-text level="3" size="lg">Menu</lc-text></div>
    <lc-nav-item label="Dashboard" icon="house"></lc-nav-item>
    <lc-nav-item label="Projects" icon="folder"></lc-nav-item>
    <lc-nav-item label="Settings" icon="settings"></lc-nav-item>
  `,
  previewWidth: 640,
  preview: () => html`
    <lc-sidebar>
      <div slot="header">
        <lc-icon name="shield"></lc-icon>
        <span>Admin</span>
      </div>
      <lc-menu variant="sidebar">
        <li><lc-link href="#" icon="layout-dashboard">Dashboard</lc-link></li>
        <li><lc-link href="#" icon="users">Users</lc-link></li>
        <li><lc-link href="#" icon="settings">Settings</lc-link></li>
      </lc-menu>
    </lc-sidebar>
  `,
  examples: [
    {
      title: "Basic with menu",
      render: () => html`
        <lc-sidebar>
          <div slot="header">
            <lc-icon name="shield"></lc-icon>
            <span>Admin</span>
          </div>

          <lc-menu variant="sidebar">
            <li><lc-link href="#" icon="layout-dashboard">Dashboard</lc-link></li>
            <li><lc-link href="#" icon="users">Users</lc-link></li>
            <li><lc-link href="#" icon="settings">Settings</lc-link></li>
          </lc-menu>

          <div slot="footer">
            <lc-darkmode></lc-darkmode>
          </div>
        </lc-sidebar>
      `,
    },
    {
      title: "Accordion menu",
      render: () => html`
        <lc-sidebar>
          <lc-menu variant="sidebar">
            <li><lc-link href="#" icon="house">Home</lc-link></li>
            <li>
              <details open>
                <summary><lc-icon name="database"></lc-icon> Models</summary>
                <ul>
                  <li><lc-link href="#">Users</lc-link></li>
                  <li><lc-link href="#">Posts</lc-link></li>
                </ul>
              </details>
            </li>
          </lc-menu>
        </lc-sidebar>
      `,
    },
  ],
};
