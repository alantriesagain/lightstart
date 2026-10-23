import { html } from "@bootstrapp/light/html";

export default {
  description: "The outermost frame of an app, switching layout between phone and desktop.",
  slot: () => html`
    <div slot="header"><lc-app-header title="My App"></lc-app-header></div>
    <div style="padding: 24px;">Main content area</div>
  `,
  preview: () => html`
    <div style="height: 240px; overflow: hidden; background: var(--color-surface-dark)">
      <lc-app-header title="My App"></lc-app-header>
      <lc-flex gap="md" class="p-4">
        <lc-card padding="md" style="flex: 1"><lc-text size="sm" muted>Revenue</lc-text><lc-text size="xl" weight="bold">$8,628</lc-text></lc-card>
        <lc-card padding="md" style="flex: 1"><lc-text size="sm" muted>Orders</lc-text><lc-text size="xl" weight="bold">1,204</lc-text></lc-card>
        <lc-card padding="md" style="flex: 1"><lc-text size="sm" muted>Visitors</lc-text><lc-text size="xl" weight="bold">32k</lc-text></lc-card>
      </lc-flex>
    </div>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "A phone dashboard",
      render: () => html`
        <lc-device device="iphone" height="800px">
          <lc-app-container layout="mobile">
          <lc-app-header slot="header">
            <lc-text slot="title" level="5">Statistics</lc-text>
            <button slot="end"><lc-icon name="bell"></lc-icon></button>
          </lc-app-header>
          <lc-flex direction="column" gap="lg" style="padding: var(--spacing-lg);">
            <lc-metric-hero-card
              label="This Month"
              value="$8,628"
              subtitle="Compared to Last Month"
              gradientFrom="#11998e"
              gradientTo="#38ef7d"
              shadow="md"
            >
              <div slot="chart">
                <lc-flex gap="xs" align="end" style="height: 60px;">
                  <div style="flex: 1; background: rgba(255,255,255,0.3); border-radius: 4px; height: 45%;"></div>
                  <div style="flex: 1; background: rgba(255,255,255,0.7); border-radius: 4px; height: 75%;"></div>
                  <div style="flex: 1; background: rgba(255,255,255,0.9); border-radius: 4px; height: 100%;"></div>
                  <div style="flex: 1; background: rgba(255,255,255,0.7); border-radius: 4px; height: 85%;"></div>
                  <div style="flex: 1; background: rgba(255,255,255,0.5); border-radius: 4px; height: 65%;"></div>
                </lc-flex>
              </div>
            </lc-metric-hero-card>
            <section>
              <lc-text level="6" style="margin-bottom: var(--spacing-md)">Overview</lc-text>
              <lc-grid columns="2" gap="md">
                <lc-card
                  label="Total Users"
                  value="1,234"
                  change="+8%"
                  changeVariant="success"
                  icon="trending-up"
                  shadow="sm"
                ></lc-card>
                <lc-card
                  label="Tasks Done"
                  value="560"
                  change="+15%"
                  changeVariant="success"
                  icon="circle-check"
                  shadow="sm"
                ></lc-card>
                <lc-card
                  label="Page Views"
                  value="12.3k"
                  change="+5%"
                  changeVariant="warning"
                  icon="eye"
                  shadow="sm"
                ></lc-card>
                <lc-card
                  label="Active Now"
                  value="89"
                  change="-2%"
                  changeVariant="danger"
                  icon="users"
                  shadow="sm"
                ></lc-card>
              </lc-grid>
            </section>
            <section>
              <lc-card shadow="md" style="--card-gradient-from: #ee9ca7; --card-linear-to: #ffdde1; padding: var(--spacing-lg);">
                <lc-flex direction="column" gap="md">
                  <lc-flex justify="space-between">
                    <div>
                      <lc-text level="4" style="color: #d63447;">560 done</lc-text>
                      <lc-text size="sm" style="color: #d63447; opacity: 0.8;">268 works in progress</lc-text>
                    </div>
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center;">
                      <lc-text weight="bold" style="color: #d63447; font-size: 24px;">560</lc-text>
                    </div>
                  </lc-flex>
                </lc-flex>
              </lc-card>
            </section>
          </lc-flex>
            <lc-bottom-nav slot="bottom-nav">
              <a href="#"><lc-icon name="house"></lc-icon>Home</a>
              <a href="#" class="active"><lc-icon name="chart-bar"></lc-icon>Statistics</a>
              <a href="#"><lc-icon name="settings"></lc-icon>Settings</a>
            </lc-bottom-nav>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Basic mobile",
      render: () => html`
        <lc-device device="iphone" height="800px">
          <lc-app-container layout="mobile">
            <lc-app-header slot="header" title="My App"></lc-app-header>

            <div>Main content here</div>

            <lc-bottom-nav slot="bottom-nav">
              <a href="#"><lc-icon name="house"></lc-icon>Home</a>
              <a href="#"><lc-icon name="search"></lc-icon>Search</a>
              <a href="#"><lc-icon name="user"></lc-icon>Profile</a>
            </lc-bottom-nav>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Basic desktop",
      render: () => html`
        <lc-app-container layout="desktop">
          <lc-title-bar slot="titlebar" title="My Application"></lc-title-bar>

          <lc-sidebar slot="sidebar">
            <nav>
              <a href="#">Dashboard</a>
              <a href="#">Projects</a>
              <a href="#">Settings</a>
            </nav>
          </lc-sidebar>

          <div>Main content here</div>
        </lc-app-container>
      `,
    },
  ],
};
