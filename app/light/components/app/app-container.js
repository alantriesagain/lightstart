import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { env } from "/app/light/env/index.js";

/** @import { AppRouteState, Prop } from "../types.js" */

export default defineComponent({
  tag: "lc-app-container",
  props: {
    layout: T.string({
      defaultValue: "auto",
      enum: ["auto", "mobile", "desktop"],
    }),

    useSafeArea: true,

    multiPane: false,

    currentRoute: "/",
    routes: T.object({}),

    height: "100vh",

    currentBreakpoint: T.string({ reactive: false, defaultValue: "xs" }),
    isMobile: T.boolean({ reactive: false, defaultValue: false }),
  },
  style: true,

  connected() {
    this.currentBreakpoint = env.breakpoint;
    this.isMobile = ["xs", "sm"].includes(this.currentBreakpoint);

    this.$own(env.subscribe(({ breakpoint }) => {
      if (this.layout !== "auto" || breakpoint === this.currentBreakpoint) return;
      const wasMobile = this.isMobile;
      this.currentBreakpoint = breakpoint;
      this.isMobile = ["xs", "sm"].includes(breakpoint);

      if (wasMobile !== this.isMobile)
        this.$emit("layout-change", {
          layout: this.isMobile ? "mobile" : "desktop",
          breakpoint,
        });

      this.$requestUpdate();
    }));

    /** @type {(e: PopStateEvent) => void} */
    const onPopState = (e) => {
      const { state } = /** @type {{ state: AppRouteState | null }} */ (e);
      if (state?.path) {
        const oldRoute = this.currentRoute;
        this.currentRoute = state.path;
        this.$emit("route-change", {
          from: oldRoute,
          to: state.path,
          params: state.params || {},
        });
      }
    };
    window.addEventListener("popstate", onPopState);
    this.$own(() => window.removeEventListener("popstate", onPopState));
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("height"))
      this.style.setProperty("--app-container-height", this.height);

  },

  /**
   * @param {string} path
   * @param {Record<string, string>} [params]
   */
  navigate(path, params = {}) {
    const oldRoute = this.currentRoute;
    this.currentRoute = path;

    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });

    window.history.pushState({ path, params }, "", url);

    this.$emit("navigate", { path, params });
    this.$emit("route-change", { from: oldRoute, to: path, params });

    this.scrollToTop();
  },

  goBack() {
    window.history.back();
  },

  scrollToTop() {
    const content = this.querySelector('[part="lc-app-container-content"]');
    if (content)
      content.scrollTo({ top: 0, behavior: "smooth" });

  },

  render() {
    const effectiveLayout =
      this.layout === "auto"
        ? this.isMobile
          ? "mobile"
          : "desktop"
        : this.layout;

    return effectiveLayout === "mobile"
      ? this.renderMobileLayout()
      : this.renderDesktopLayout();
  },

  renderMobileLayout() {
    return html`
      <div part="lc-app-container-container" class="mobile-container">
        ${
          env.window?.frameless
            ? html`<div part="lc-app-container-titlebar" class="desktop-titlebar"><slot name="titlebar"></slot></div>`
            : ""
        }
        <div part="lc-app-container-header" class="mobile-header">
          <slot name="header"></slot>
        </div>

        <main part="lc-app-container-content" class="content">
          <slot></slot>
        </main>

        <div part="lc-app-container-bottom-nav" class="mobile-bottom-nav">
          <slot name="bottom-nav"></slot>
        </div>

        <div part="lc-app-container-floating-action" class="mobile-floating-action">
          <slot name="floating-action"></slot>
        </div>
      </div>
    `;
  },

  renderDesktopLayout() {
    return html`
      <div part="lc-app-container-container" class="desktop-container">
        <div part="lc-app-container-titlebar" class="desktop-titlebar">
          <slot name="titlebar"></slot>
        </div>

        <div part="lc-app-container-body" class="desktop-body">
          <div part="lc-app-container-sidebar" class="desktop-sidebar">
            <slot name="sidebar"></slot>
          </div>

          <div part="lc-app-container-main" class="desktop-main">
            <div part="lc-app-container-toolbar" class="desktop-toolbar">
              <slot name="toolbar"></slot>
            </div>

            <main part="lc-app-container-content" class="content">
              <slot></slot>
            </main>
          </div>

          ${
            this.multiPane
              ? html`
                <div part="lc-app-container-panel" class="secondary-panel">
                  <slot name="panel-secondary"></slot>
                </div>
              `
              : ""
          }
        </div>

        <div part="lc-app-container-statusbar" class="status-bar">
          <slot name="status-bar"></slot>
        </div>
      </div>
    `;
  },
});

/**
 * App Container Component
 *
 * @component
 * @category layout
 * @tag lc-app-container
 *
 * A unified responsive app container that automatically switches between mobile
 * and desktop layouts based on viewport size. Includes routing, navigation,
 * and app chrome components.
 *
 * @slot default - Main content area (shared)
 * @slot header - Mobile: header component (e.g., lc-app-header)
 * @slot bottom-nav - Mobile: bottom navigation component
 * @slot floating-action - Mobile: floating action button
 * @slot titlebar - Desktop: title bar component (e.g., lc-title-bar); also in the mobile layout inside a frameless desktop window, which has no other way to close
 * @slot sidebar - Desktop: sidebar component (e.g., lc-sidebar)
 * @slot toolbar - Desktop: top toolbar/breadcrumbs
 * @slot panel-secondary - Desktop: secondary panel (multi-pane mode)
 * @slot status-bar - Desktop: bottom status bar
 *
 * @part container - The main container
 * @part header - Mobile: the header component
 * @part content - The main content area
 * @part bottom-nav - Mobile: the bottom navigation
 * @part titlebar - Desktop: the title bar
 * @part sidebar - Desktop: the sidebar
 * @part body - Desktop: the body container
 * @part main - Desktop: the main content area
 * @part toolbar - Desktop: the toolbar area
 * @part panel - Desktop: the secondary panel
 * @part statusbar - Desktop: the status bar
 *
 * @example Modern Payment App with Drawer (800px for viewer)
 * ```html
 * <lc-device device="iphone" height="800px">
 *   <lc-app-container layout="mobile">
 *     <!-- Header with user greeting -->
 *     <lc-app-header slot="header">
 *       <button slot="start" onclick="document.querySelector('#paymentDrawer').toggleDrawer()">
 *         <lc-icon name="menu"></lc-icon>
 *       </button>
 *       <lc-flex slot="title" align="center" gap="sm">
 *         <lc-avatar name="Chad Smith" size="sm" status="online"></lc-avatar>
 *         <lc-flex direction="column" gap="none">
 *           <lc-text size="xs" color="muted">Hello Chad,</lc-text>
 *           <lc-text level="6">Welcome Back</lc-text>
 *         </lc-flex>
 *       </lc-flex>
 *       <button slot="end"><lc-icon name="bell"></lc-icon></button>
 *     </lc-app-header>
 *
 *     <!-- Drawer navigation using lc-drawer -->
 *     <lc-drawer id="paymentDrawer">
 *       <div style="padding: var(--spacing-lg);">
 *         <div style="padding-bottom: var(--spacing-lg); border-bottom: 1px solid var(--border-color); margin-bottom: var(--spacing-lg);">
 *           <lc-flex align="center" gap="md">
 *             <lc-avatar name="Chad Smith" size="lg"></lc-avatar>
 *             <lc-flex direction="column" gap="none">
 *               <lc-text level="5">Chad Smith</lc-text>
 *               <lc-text size="sm" color="muted">chad@example.com</lc-text>
 *             </lc-flex>
 *           </lc-flex>
 *         </div>
 *         <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
 *           <a href="/" style="display: flex; align-items: center; gap: var(--spacing-md);"><lc-icon name="house"></lc-icon>Home</a>
 *           <a href="/wallet" style="display: flex; align-items: center; gap: var(--spacing-md);"><lc-icon name="credit-card"></lc-icon>Wallet</a>
 *           <a href="/stats" style="display: flex; align-items: center; gap: var(--spacing-md);"><lc-icon name="chart-bar"></lc-icon>Statistics</a>
 *           <a href="/settings" style="display: flex; align-items: center; gap: var(--spacing-md);"><lc-icon name="settings"></lc-icon>Settings</a>
 *           <a href="/help" style="display: flex; align-items: center; gap: var(--spacing-md);"><lc-icon name="circle-help"></lc-icon>Help & Support</a>
 *         </nav>
 *       </div>
 *     </lc-drawer>
 *
 *   <!-- Main content with cards -->
 *   <lc-flex direction="column" gap="lg" style="padding: var(--spacing-lg);">
 *     <!-- Card Wallet Section -->
 *     <section>
 *       <lc-text level="6" style="margin-bottom: var(--spacing-md)">My Cards</lc-text>
 *       <lc-grid columns="2" gap="md">
 *         <lc-card shadow="md" style="--card-gradient-from: #667eea; --card-linear-to: #764ba2; color: white; padding: var(--spacing-lg)">
 *           <lc-flex direction="column" justify="space-between" style="height: 150px">
 *             <lc-flex justify="space-between">
 *               <lc-icon name="credit-card" size="lg"></lc-icon>
 *               <lc-icon name="wifi" size="sm"></lc-icon>
 *             </lc-flex>
 *             <div>
 *               <lc-text size="xs" style="opacity: 0.8">Card Number</lc-text>
 *               <lc-text weight="semibold">•••• 5436</lc-text>
 *             </div>
 *           </lc-flex>
 *         </lc-card>
 *         <lc-card shadow="md" style="--card-gradient-from: #f093fb; --card-linear-to: #f5576c; color: white; padding: var(--spacing-lg)">
 *           <lc-flex direction="column" justify="space-between" style="height: 150px">
 *             <lc-flex justify="space-between">
 *               <lc-icon name="credit-card" size="lg"></lc-icon>
 *               <lc-icon name="wifi" size="sm"></lc-icon>
 *             </lc-flex>
 *             <div>
 *               <lc-text size="xs" style="opacity: 0.8">Card Number</lc-text>
 *               <lc-text weight="semibold">•••• 8375</lc-text>
 *             </div>
 *           </lc-flex>
 *         </lc-card>
 *       </lc-grid>
 *     </section>
 *
 *     <!-- Quick Actions -->
 *     <section>
 *       <lc-flex gap="md" justify="space-around">
 *         <lc-flex direction="column" align="center" gap="xs">
 *           <button style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-primary); border: none;">
 *             <lc-icon name="send" color="inverse" size="lg"></lc-icon>
 *           </button>
 *           <lc-text size="sm">Send</lc-text>
 *         </lc-flex>
 *         <lc-flex direction="column" align="center" gap="xs">
 *           <button style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-success); border: none;">
 *             <lc-icon name="download" color="inverse" size="lg"></lc-icon>
 *           </button>
 *           <lc-text size="sm">Request</lc-text>
 *         </lc-flex>
 *         <lc-flex direction="column" align="center" gap="xs">
 *           <button style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-warning); border: none;">
 *             <lc-icon name="file-text" color="inverse" size="lg"></lc-icon>
 *           </button>
 *           <lc-text size="sm">Bill</lc-text>
 *         </lc-flex>
 *         <lc-flex direction="column" align="center" gap="xs">
 *           <button style="width: 60px; height: 60px; border-radius: 50%; background: var(--color-surface); border: 1px solid var(--border-color);">
 *             <lc-icon name="ellipsis" size="lg"></lc-icon>
 *           </button>
 *           <lc-text size="sm">More</lc-text>
 *         </lc-flex>
 *       </lc-flex>
 *     </section>
 *
 *     <!-- Recent Contacts -->
 *     <section>
 *       <lc-flex justify="space-between" align="center" style="margin-bottom: var(--spacing-md)">
 *         <lc-text level="6">Recent Contacts</lc-text>
 *         <lc-text size="sm" color="primary">See All</lc-text>
 *       </lc-flex>
 *       <lc-flex gap="lg" style="overflow-x: auto; padding-bottom: var(--spacing-sm)">
 *         <lc-contact-avatar name="Jeff Wilson" size="md"></lc-contact-avatar>
 *         <lc-contact-avatar name="Clara Martinez" size="md"></lc-contact-avatar>
 *         <lc-contact-avatar name="Burak Yilmaz" size="md"></lc-contact-avatar>
 *         <lc-contact-avatar name="Sheila Brown" size="md"></lc-contact-avatar>
 *         <lc-flex direction="column" align="center" gap="xs" style="min-width: 60px">
 *           <button style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-surface); border: 1px dashed var(--border-color);">
 *             <lc-icon name="search" size="sm"></lc-icon>
 *           </button>
 *           <lc-text size="xs">Find</lc-text>
 *         </lc-flex>
 *       </lc-flex>
 *     </section>
 *
 *     <!-- Transactions History -->
 *     <section>
 *       <lc-flex justify="space-between" align="center" style="margin-bottom: var(--spacing-md)">
 *         <lc-text level="6">Transactions</lc-text>
 *         <lc-flex align="center" gap="xs">
 *           <lc-text size="sm" color="muted">Today</lc-text>
 *           <lc-icon name="chevron-down" size="sm"></lc-icon>
 *         </lc-flex>
 *       </lc-flex>
 *       <lc-flex direction="column" gap="sm">
 *         <lc-card shadow="sm" hover>
 *           <lc-flex align="center" justify="space-between" style="padding: var(--spacing-md)">
 *             <lc-flex align="center" gap="md">
 *               <div style="width: 48px; height: 48px; border-radius: 12px; background: #000; display: flex; align-items: center; justify-content: center">
 *                 <lc-icon name="apple" color="inverse" size="lg"></lc-icon>
 *               </div>
 *               <lc-flex direction="column" gap="none">
 *                 <lc-text weight="semibold">Dinner</lc-text>
 *                 <lc-text size="sm" color="muted">13th April 2022</lc-text>
 *               </lc-flex>
 *             </lc-flex>
 *             <lc-text weight="bold" color="danger">-$45</lc-text>
 *           </lc-flex>
 *         </lc-card>
 *         <lc-card shadow="sm" hover>
 *           <lc-flex align="center" justify="space-between" style="padding: var(--spacing-md)">
 *             <lc-flex align="center" gap="md">
 *               <lc-avatar name="John Doe" size="md"></lc-avatar>
 *               <lc-flex direction="column" gap="none">
 *                 <lc-text weight="semibold">Birthday Gift</lc-text>
 *                 <lc-text size="sm" color="muted">13th April 2022</lc-text>
 *               </lc-flex>
 *             </lc-flex>
 *             <lc-text weight="bold" color="danger">-$220</lc-text>
 *           </lc-flex>
 *         </lc-card>
 *         <lc-card shadow="sm" hover>
 *           <lc-flex align="center" justify="space-between" style="padding: var(--spacing-md)">
 *             <lc-flex align="center" gap="md">
 *               <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--color-warning-light); display: flex; align-items: center; justify-content: center">
 *                 <lc-icon name="shopping-bag" color="warning" size="lg"></lc-icon>
 *               </div>
 *               <lc-flex direction="column" gap="none">
 *                 <lc-text weight="semibold">House Cleaning</lc-text>
 *                 <lc-text size="sm" color="muted">10th April 2022</lc-text>
 *               </lc-flex>
 *             </lc-flex>
 *             <lc-text weight="bold" color="danger">-$55</lc-text>
 *           </lc-flex>
 *         </lc-card>
 *       </lc-flex>
 *     </section>
 *   </lc-flex>
 *
 *     <!-- Bottom Navigation -->
 *     <lc-bottom-nav slot="bottom-nav">
 *       <a href="/" class="active"><lc-icon name="house"></lc-icon>Home</a>
 *       <a href="/wallet"><lc-icon name="credit-card"></lc-icon>Wallet</a>
 *       <a href="/stats"><lc-icon name="chart-bar-big"></lc-icon>Stats</a>
 *       <a href="/profile"><lc-icon name="user"></lc-icon>Profile</a>
 *     </lc-bottom-nav>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Mobile Stats Dashboard (800px)
 * ```html
 * <lc-device device="iphone" height="800px">
 *   <lc-app-container layout="mobile">
 *   <lc-app-header slot="header">
 *     <lc-text slot="title" level="5">Statistics</lc-text>
 *     <button slot="end"><lc-icon name="bell"></lc-icon></button>
 *   </lc-app-header>
 *   <lc-flex direction="column" gap="lg" style="padding: var(--spacing-lg);">
 *     <lc-metric-hero-card
 *       label="This Month"
 *       value="$8,628"
 *       subtitle="Compared to Last Month"
 *       gradientFrom="#11998e"
 *       gradientTo="#38ef7d"
 *       shadow="md"
 *     >
 *       <div slot="chart">
 *         <lc-flex gap="xs" align="end" style="height: 60px;">
 *           <div style="flex: 1; background: rgba(255,255,255,0.3); border-radius: 4px; height: 45%;"></div>
 *           <div style="flex: 1; background: rgba(255,255,255,0.7); border-radius: 4px; height: 75%;"></div>
 *           <div style="flex: 1; background: rgba(255,255,255,0.9); border-radius: 4px; height: 100%;"></div>
 *           <div style="flex: 1; background: rgba(255,255,255,0.7); border-radius: 4px; height: 85%;"></div>
 *           <div style="flex: 1; background: rgba(255,255,255,0.5); border-radius: 4px; height: 65%;"></div>
 *         </lc-flex>
 *       </div>
 *     </lc-metric-hero-card>
 *     <section>
 *       <lc-text level="6" style="margin-bottom: var(--spacing-md)">Overview</lc-text>
 *       <lc-grid columns="2" gap="md">
 *         <lc-card
 *           label="Total Users"
 *           value="1,234"
 *           change="+8%"
 *           changeVariant="success"
 *           icon="trending-up"
 *           shadow="sm"
 *         ></lc-card>
 *         <lc-card
 *           label="Tasks Done"
 *           value="560"
 *           change="+15%"
 *           changeVariant="success"
 *           icon="circle-check"
 *           shadow="sm"
 *         ></lc-card>
 *         <lc-card
 *           label="Page Views"
 *           value="12.3k"
 *           change="+5%"
 *           changeVariant="warning"
 *           icon="eye"
 *           shadow="sm"
 *         ></lc-card>
 *         <lc-card
 *           label="Active Now"
 *           value="89"
 *           change="-2%"
 *           changeVariant="danger"
 *           icon="users"
 *           shadow="sm"
 *         ></lc-card>
 *       </lc-grid>
 *     </section>
 *     <section>
 *       <lc-card shadow="md" style="--card-gradient-from: #ee9ca7; --card-linear-to: #ffdde1; padding: var(--spacing-lg);">
 *         <lc-flex direction="column" gap="md">
 *           <lc-flex justify="space-between">
 *             <div>
 *               <lc-text level="4" style="color: #d63447;">560 done</lc-text>
 *               <lc-text size="sm" style="color: #d63447; opacity: 0.8;">268 works in progress</lc-text>
 *             </div>
 *             <div style="width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center;">
 *               <lc-text weight="bold" style="color: #d63447; font-size: 24px;">560</lc-text>
 *             </div>
 *           </lc-flex>
 *         </lc-flex>
 *       </lc-card>
 *     </section>
 *   </lc-flex>
 *     <lc-bottom-nav slot="bottom-nav">
 *       <a href="/"><lc-icon name="house"></lc-icon>Home</a>
 *       <a href="/stats" class="active"><lc-icon name="chart-bar"></lc-icon>Statistics</a>
 *       <a href="/settings"><lc-icon name="settings"></lc-icon>Settings</a>
 *     </lc-bottom-nav>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Basic Mobile App
 * ```html
 * <lc-device device="iphone" height="800px">
 *   <lc-app-container layout="mobile">
 *     <lc-app-header slot="header" title="My App"></lc-app-header>
 *
 *     <div>Main content here</div>
 *
 *     <lc-bottom-nav slot="bottom-nav">
 *       <a href="/"><lc-icon name="house"></lc-icon>Home</a>
 *       <a href="/search"><lc-icon name="search"></lc-icon>Search</a>
 *       <a href="/profile"><lc-icon name="user"></lc-icon>Profile</a>
 *     </lc-bottom-nav>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Basic Desktop App
 * ```html
 * <lc-app-container layout="desktop">
 *   <lc-title-bar slot="titlebar" title="My Application"></lc-title-bar>
 *
 *   <lc-sidebar slot="sidebar">
 *     <nav>
 *       <a href="/">Dashboard</a>
 *       <a href="/projects">Projects</a>
 *       <a href="/settings">Settings</a>
 *     </nav>
 *   </lc-sidebar>
 *
 *   <div>Main content here</div>
 * </lc-app-container>
 * ```
 *
 * @example Auto-Responsive (Default)
 * ```html
 * <lc-app-container
 *   layout="auto"
 *   @layout-change=${(e) => console.log('Layout changed:', e.detail.layout)}
 * >
 *   <!-- Mobile header -->
 *   <lc-app-header slot="header" title="My App"></lc-app-header>
 *
 *   <!-- Desktop titlebar -->
 *   <lc-title-bar slot="titlebar" title="My Application"></lc-title-bar>
 *
 *   <!-- Desktop sidebar -->
 *   <lc-sidebar slot="sidebar">
 *     <nav>Navigation links</nav>
 *   </lc-sidebar>
 *
 *   <div>Content that works on both layouts</div>
 * </lc-app-container>
 * ```
 *
 * @example With Routing
 * ```html
 * <lc-app-container
 *   .currentRoute=${this.route}
 *   @navigate=${(e) => this.handleNavigate(e.detail)}
 *   @route-change=${(e) => console.log('Route:', e.detail)}
 * >
 *   <div>${this.renderCurrentView()}</div>
 * </lc-app-container>
 * ```
 *
 * @example Full-Featured Mobile
 * ```html
 * <lc-app-container layout="mobile">
 *   <lc-app-header slot="header" title="Messages" show-back-button @back-click=${() => this.goBack()}>
 *     <button slot="end">
 *       <lc-icon name="search"></lc-icon>
 *     </button>
 *   </lc-app-header>
 *
 *   <div class="messages-list">
 *     ${this.messages.map(m => html`<div>${m.text}</div>`)}
 *   </div>
 *
 *   <lc-bottom-nav slot="bottom-nav">
 *     ${this.tabs.map(tab => html`<a href="${tab.href}">${tab.label}</a>`)}
 *   </lc-bottom-nav>
 * </lc-app-container>
 * ```
 *
 * @example Full-Featured Desktop
 * ```html
 * <lc-app-container layout="desktop" multi-pane>
 *   <lc-title-bar slot="titlebar" title="IDE - main.js"></lc-title-bar>
 *
 *   <lc-sidebar slot="sidebar" collapsible>
 *     <div slot="header">
 *       <img src="/logo.svg" alt="Logo">
 *     </div>
 *     <lc-tree .items=${this.files}></lc-tree>
 *   </lc-sidebar>
 *
 *   <div slot="toolbar">
 *     <lc-breadcrumbs .items=${this.path}></lc-breadcrumbs>
 *   </div>
 *
 *   <div>Code editor here</div>
 *
 *   <div slot="panel-secondary">
 *     Console output
 *   </div>
 *
 *   <div slot="status-bar">
 *     Line 42, Col 15
 *   </div>
 * </lc-app-container>
 * ```
 *
 *
 * @example Desktop with Navigation Drawer
 * ```html
 * <lc-app-container layout="desktop">
 *   <lc-title-bar slot="titlebar" title="Email Client">
 *     <button slot="start" onclick="document.querySelector('#emailDrawer').toggleDrawer()">
 *       <lc-icon name="menu"></lc-icon>
 *     </button>
 *   </lc-title-bar>
 *
 *   <!-- Navigation drawer using lc-drawer -->
 *   <lc-drawer id="emailDrawer" persistent open>
 *     <div style="padding: 1rem; background: var(--color-surface);">
 *       <h3>Folders</h3>
 *       <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
 *         <a href="/inbox">📥 Inbox (12)</a>
 *         <a href="/drafts">📝 Drafts</a>
 *         <a href="/sent">📤 Sent</a>
 *         <a href="/spam">🚫 Spam</a>
 *         <a href="/trash">🗑️ Trash</a>
 *       </nav>
 *     </div>
 *   </lc-drawer>
 *
 *   <!-- Sidebar for account switching -->
 *   <lc-sidebar slot="sidebar">
 *     <div style="padding: 1rem;">
 *       <h4>Accounts</h4>
 *       <div>personal@email.com</div>
 *       <div>work@company.com</div>
 *     </div>
 *   </lc-sidebar>
 *
 *   <!-- Main email content -->
 *   <div>
 *     <h2>Email Messages</h2>
 *   </div>
 *
 *   <div slot="status-bar">
 *     12 messages • Last sync: 2 minutes ago
 *   </div>
 * </lc-app-container>
 * ```
 *
 * @example Complete Feature Showcase
 * ```html
 * <lc-app-container
 *   layout="auto"
 *   height="var(--app-height, 100vh)"
 *   multi-pane
 * >
 *   <!-- Mobile header -->
 *   <lc-app-header slot="header" title="My App">
 *     <button slot="start" onclick="document.querySelector('#featureDrawer').toggleDrawer()">
 *       <lc-icon name="menu"></lc-icon>
 *     </button>
 *   </lc-app-header>
 *
 *   <!-- Desktop titlebar -->
 *   <lc-title-bar slot="titlebar" title="My Application">
 *     <button slot="start" onclick="document.querySelector('#featureDrawer').toggleDrawer()">
 *       <lc-icon name="sidebar"></lc-icon>
 *     </button>
 *   </lc-title-bar>
 *
 *   <!-- Responsive drawer with navigation using lc-drawer -->
 *   <lc-drawer
 *     id="featureDrawer"
 *     width="320px"
 *     @drawer-opened=${(e) => console.log('Drawer opened')}
 *     @drawer-closed=${() => console.log('Drawer closed')}
 *   >
 *     <div style="padding: 2rem;">
 *       <h3 style="margin-bottom: 1rem;">Quick Actions</h3>
 *       <nav style="display: flex; flex-direction: column; gap: 0.75rem;">
 *         <a href="/new">➕ New Document</a>
 *         <a href="/recent">🕐 Recent Files</a>
 *         <a href="/starred">⭐ Starred</a>
 *         <a href="/shared">👥 Shared with me</a>
 *         <hr>
 *         <a href="/settings">⚙️ Settings</a>
 *         <a href="/help">❓ Help & Support</a>
 *       </nav>
 *     </div>
 *   </lc-drawer>
 *
 *   <!-- Desktop sidebar -->
 *   <lc-sidebar slot="sidebar" collapsible>
 *     <div>Main Navigation</div>
 *   </lc-sidebar>
 *
 *   <!-- Toolbar -->
 *   <div slot="toolbar">
 *     <lc-breadcrumbs .items=${['Home', 'Documents', 'Report.pdf']}></lc-breadcrumbs>
 *   </div>
 *
 *   <!-- Main content with proper scrolling -->
 *   <div style="padding: 2rem;">
 *     <h1>Content Area</h1>
 *     <p>This area scrolls independently while drawer, header, and bottom nav stay fixed.</p>
 *   </div>
 *
 *   <!-- Secondary panel (desktop multi-pane) -->
 *   <div slot="panel-secondary" style="padding: 1rem;">
 *     <h4>Properties</h4>
 *     <p>Document metadata and properties</p>
 *   </div>
 *
 *   <!-- Bottom nav (mobile) -->
 *   <lc-bottom-nav slot="bottom-nav">
 *     <a href="/"><lc-icon name="house"></lc-icon>Home</a>
 *     <a href="/search"><lc-icon name="search"></lc-icon>Search</a>
 *     <a href="/favorites"><lc-icon name="star"></lc-icon>Favorites</a>
 *     <a href="/profile"><lc-icon name="user"></lc-icon>Profile</a>
 *   </lc-bottom-nav>
 *
 *   <!-- Status bar (desktop) -->
 *   <div slot="status-bar">
 *     Ready • Line 42, Col 15 • UTF-8
 *   </div>
 * </lc-app-container>
 * ```
 *
 * @example Custom Height Control
 * ```html
 * <!-- Using property -->
 * <lc-app-container height="600px">
 *   <!-- content -->
 * </lc-app-container>
 *
 * <!-- Using CSS variable -->
 * <lc-app-container style="--app-container-height: calc(100vh - 80px)">
 *   <!-- content -->
 * </lc-app-container>
 *
 * <!-- Dynamic height from JavaScript -->
 * <lc-app-container id="myApp"></lc-app-container>
 * <script>
 *   document.getElementById('myApp').height = '800px';
 *   // Or via CSS variable:
 *   document.getElementById('myApp').style.setProperty('--app-container-height', '800px');
 * </script>
 * ```
 */
