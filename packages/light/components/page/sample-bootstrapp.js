import { html } from "@bootstrapp/light/html";

/** @import { SamplePage } from "../types.ts" */

const LOGO_HEADER = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="url(#paint_logo)"></circle>
    <path d="M12 5V19M5 12H19M8 8L16 16M8 16L16 8" stroke="white" stroke-width="2" stroke-linecap="round"></path>
    <defs>
      <linearGradient id="paint_logo" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FF6B6B"></stop>
        <stop offset="0.5" stop-color="#4ECDC4"></stop>
        <stop offset="1" stop-color="#FFE66D"></stop>
      </linearGradient>
    </defs>
  </svg>
`;

const LOGO_FOOTER = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="url(#paint_footer)"></circle>
    <path d="M12 5V19M5 12H19M8 8L16 16M8 16L16 8" stroke="white" stroke-width="2" stroke-linecap="round"></path>
    <defs>
      <linearGradient id="paint_footer" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FF6B6B"></stop>
        <stop offset="0.5" stop-color="#4ECDC4"></stop>
        <stop offset="1" stop-color="#FFE66D"></stop>
      </linearGradient>
    </defs>
  </svg>
`;

const SITE_HEADER = {
  brand: { logo: LOGO_HEADER, name: "Bootstrapp", href: "#" },
  links: [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Why Bootstrapp?", href: "#features" },
    { label: "Case Studies", href: "#testimonials" },
    { label: "FAQ", href: "#faq" },
    { label: "Pricing", href: "#" },
  ],
  actions: [
    { label: "Login", href: "#", variant: "ghost" },
    { label: "Contact Us", href: "#", variant: "primary" },
  ],
};

const HERO = {
  eyebrow: {
    badge: "New",
    label: "Frontend Framework",
    meta: "Try now ›",
    href: "#",
  },
  headline: "Build Modern Web Apps <br>Without the Bloat ",
  subheadline:
    "A ~30KB frontend framework with light DOM components, reactive data, and built-in Service Worker caching. Everything you need, nothing you don't.",
  ctas: [
    { label: "Get Started", href: "#", variant: "primary" },
    { label: "View on GitHub", href: "#", variant: "secondary" },
  ],
};

const FEATURES = {
  eyebrow: "Features",
  headline: "Why Developers Choose Bootstrapp",
  subheadline:
    "Everything you need to build fast, modern web apps without the complexity.",
  features: [
    {
      icon: "shield",
      title: "~30KB Runtime",
      description:
        "Lightweight and tree-shakable. Load only what you use, and keep your bundle sizes tiny.",
    },
    {
      icon: "trending-up",
      title: "Reactive Model Layer",
      description:
        "ORM-style data with IndexedDB sync, reactive arrays, and automatic cross-tab updates.",
    },
    {
      icon: "globe",
      title: "Service Worker Ready",
      description:
        "Built-in caching, offline support, and cross-tab messaging. No plugins required.",
    },
    {
      icon: "clock",
      title: "Light DOM Components",
      description:
        "No shadow DOM penalty. Your global CSS just works, and the browser inspector stays readable.",
    },
    {
      icon: "target",
      title: "Type System",
      description:
        "Declarative T.* types with validation, defaults, and first-class relationships between models.",
    },
    {
      icon: "chart-no-axes-column",
      title: "URLPattern Router",
      description:
        "Modern client-side routing built on the URLPattern API. Nested routes, params, and history just work.",
    },
  ],
};

const TESTIMONIALS = {
  eyebrow: "Testimonials",
  headline: "Loved by Developers",
  subheadline:
    "Join developers shipping fast, lightweight apps with Bootstrapp.",
  testimonials: [
    {
      quote:
        "Bootstrapp cut our bundle size by 80%. We replaced a 300KB stack with a 30KB framework and our pages load instantly.",
      author: "Sarah Chen",
      role: "Frontend Lead, Arcade",
      avatar: "https://i.pravatar.cc/100?img=5",
      rating: 5,
    },
    {
      quote:
        "The Light DOM approach just works. No shadow DOM quirks, our existing Tailwind styles apply everywhere, and reactivity is fantastic.",
      author: "Marcus Rivera",
      role: "Staff Engineer, Orbit Labs",
      avatar: "https://i.pravatar.cc/100?img=12",
      rating: 5,
    },
    {
      quote:
        "Went from prototype to production in two weekends. The built-in Service Worker gave us offline support without writing a line of extra code.",
      author: "Emma Larsson",
      role: "Indie Developer",
      avatar: "https://i.pravatar.cc/100?img=9",
      rating: 5,
    },
  ],
};

const FAQ = {
  eyebrow: "FAQ",
  headline: "Frequently Asked Questions",
  items: [
    {
      question: "What is Bootstrapp?",
      answer:
        "Bootstrapp is a ~30KB frontend framework with light DOM web components, its own tagged-template renderer, a reactive model layer, and a built-in Service Worker for caching and cross-tab sync.",
    },
    {
      question: "Is Bootstrapp open source?",
      answer:
        "Yes. Bootstrapp is AGPL-3.0 licensed and developed in the open on GitHub. You can read the source, file issues, and contribute.",
    },
    {
      question: "What are the browser requirements?",
      answer:
        "Modern evergreen browsers that support native ES modules, IndexedDB, and Service Workers. Chrome, Firefox, Safari, and Edge are all fully supported.",
    },
    {
      question: "How does it compare to React or Vue?",
      answer:
        "Bootstrapp is a native-web alternative. It uses standards like Custom Elements, URLPattern, and ES modules directly. No JSX, no virtual DOM, no build step required.",
    },
    {
      question: "Can I use Bootstrapp in production?",
      answer:
        "Absolutely. Bootstrapp ships production builds with minification, bundling, and offline caching. The dev server and build pipeline are designed for real-world deployment.",
    },
  ],
};

const CTA = {
  headline: "Ready to Ship?",
  subheadline:
    "Join developers building fast, lightweight web apps with Bootstrapp.",
  ctas: [
    { label: "Get Started", href: "#", variant: "primary" },
    { label: "Read the Docs", href: "#", variant: "secondary" },
  ],
};

const FOOTER = {
  brand: { logo: LOGO_FOOTER, name: "Bootstrapp" },
  tagline: "The lightweight frontend framework built for speed.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#" },
        { label: "Pricing", href: "#" },
        { label: "Integrations", href: "#" },
        { label: "Changelog", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Blog", href: "#" },
        { label: "Case Studies", href: "#" },
        { label: "Documentation", href: "#" },
        { label: "Support", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
        { label: "Legal", href: "#" },
      ],
    },
  ],
  copyright: "© 2026 Bootstrapp. All rights reserved.",
};

const STEPS = {
  eyebrow: "How It Works",
  eyebrowIcon: "circle-dot",
  headline: "Three Steps to Shipping",
  subheadline:
    "From install to deploy, here's everything you need to ship with Bootstrapp.",
  steps: [
    {
      number: "01",
      icon: "users",
      iconColor: "#F59E0B",
      iconBgColor: "#FFF5EB",
      iconBorderColor: "#FFEDD5",
      mockupGradientFrom: "#FFF5EB",
      mockupGradientTo: "#FFFBF5",
      title: "Install and Configure",
      description:
        "Install the CLI, scaffold a project, and you're ready to build. Sensible defaults mean zero config for most apps.",
      cta: { label: "Learn more", href: "#" },
    },
    {
      number: "02",
      icon: "zap",
      iconColor: "#3B82F6",
      iconBgColor: "#EFF6FF",
      iconBorderColor: "#DBEAFE",
      mockupGradientFrom: "#EFF6FF",
      mockupGradientTo: "#F5F8FF",
      title: "Compose Components",
      description:
        "Object-literal components with html`` templates and auto-importing. Write Light DOM widgets that play well with any CSS.",
      cta: { label: "Learn more", href: "#" },
    },
    {
      number: "03",
      icon: "file-text",
      iconColor: "#10B981",
      iconBgColor: "#ECFDF5",
      iconBorderColor: "#D1FAE5",
      mockupGradientFrom: "#ECFDF5",
      mockupGradientTo: "#F0FCFA",
      title: "Deploy Anywhere",
      description:
        "Ship to any static host, Cloudflare Workers, or your own server. The built-in Service Worker gives you offline support out of the box.",
      cta: { label: "Learn more", href: "#" },
    },
  ],
  footerCta: {
    label: "Get Started on GitHub",
    icon: "sparkles",
    href: "#",
  },
};

const renderDashboardMockup = () => html`
  <div class="dashboard-border relative z-10 mx-auto">
    <div
      class="bg-white rounded-[24px] overflow-hidden flex h-[580px] w-full border border-dim shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]"
    >
      <div
        class="w-[240px] bg-[#FCFCFA] border-r border-dim p-5 hidden md:flex flex-col"
      >
        <div
          class="flex items-center gap-2.5 font-bold text-[15px] mb-10 mt-2 px-2 text-default tracking-tight"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="url(#paint_sidebar)"></circle>
            <path
              d="M12 5V19M5 12H19M8 8L16 16M8 16L16 8"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
            ></path>
            <defs>
              <linearGradient
                id="paint_sidebar"
                x1="2"
                y1="2"
                x2="22"
                y2="22"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#FF6B6B"></stop>
                <stop offset="0.5" stop-color="#4ECDC4"></stop>
                <stop offset="1" stop-color="#FFE66D"></stop>
              </linearGradient>
            </defs>
          </svg>
          Bootstrapp
        </div>
        <p
          class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3 px-3"
        >
          Main
        </p>
        <nav class="flex flex-col gap-1.5">
          <a
            href="#"
            class="flex items-center gap-3 bg-white text-default px-3 py-2.5 rounded-xl font-bold text-[13px] shadow-sm border border-dim"
          >
            <div class="bg-surface-light p-1.5 rounded-lg border border-dim">
              <lc-icon
                name="layout-grid"
                class="w-4 h-4 text-secondary"
              ></lc-icon>
            </div>
            Overview
          </a>
          <a
            href="#"
            class="flex items-center gap-3 text-muted hover:bg-hover px-3 py-2.5 rounded-xl font-semibold text-[13px] transition"
          >
            <div class="p-1.5">
              <lc-icon name="users" class="w-4 h-4"></lc-icon>
            </div>
            Components
          </a>
          <a
            href="#"
            class="flex items-center gap-3 text-muted hover:bg-hover px-3 py-2.5 rounded-xl font-semibold text-[13px] transition"
          >
            <div class="p-1.5">
              <lc-icon name="layers" class="w-4 h-4"></lc-icon>
            </div>
            Projects
          </a>
          <a
            href="#"
            class="flex items-center gap-3 text-muted hover:bg-hover px-3 py-2.5 rounded-xl font-semibold text-[13px] transition"
          >
            <div class="p-1.5">
              <lc-icon name="message-square" class="w-4 h-4"></lc-icon>
            </div>
            Messages
          </a>
          <a
            href="#"
            class="flex items-center gap-3 text-muted hover:bg-hover px-3 py-2.5 rounded-xl font-semibold text-[13px] transition"
          >
            <div class="p-1.5">
              <lc-icon name="file-text" class="w-4 h-4"></lc-icon>
            </div>
            Case studies
          </a>
          <a
            href="#"
            class="flex items-center gap-3 text-muted hover:bg-hover px-3 py-2.5 rounded-xl font-semibold text-[13px] transition mt-2"
          >
            <div class="p-1.5">
              <lc-icon
                name="chart-no-axes-column"
                class="w-4 h-4"
              ></lc-icon>
            </div>
            Analytics
          </a>
        </nav>
      </div>
      <div
        class="flex-1 bg-gradient-to-br from-white to-[#FDFDFD] flex flex-col relative overflow-hidden"
      >
        <header class="flex justify-between items-center px-8 py-5">
          <div class="relative w-72">
            <lc-icon
              name="search"
              class="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2"
            ></lc-icon>
            <input
              type="text"
              placeholder="Search"
              class="bg-[#F8F8F8] border border-dim rounded-full py-2 pl-10 pr-4 text-[13px] w-full focus:outline-none text-secondary font-medium"
            />
          </div>
          <div class="flex items-center gap-4">
            <div
              class="hidden sm:flex items-center gap-3 bg-white border border-dim p-1.5 pr-4 rounded-full cursor-pointer"
            >
              <img
                src="https://i.pravatar.cc/100?img=33"
                class="w-7 h-7 rounded-full object-cover"
                alt=""
              />
              <div class="flex flex-col leading-none">
                <span class="text-[12.5px] font-bold text-default mb-0.5"
                  >Farhad hosen</span
                >
                <span class="text-[10px] text-muted font-medium"
                  >skfarhad97@</span
                >
              </div>
            </div>
            <button
              class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-dim text-muted hover:bg-hover"
            >
              <lc-icon name="mail" class="w-4 h-4"></lc-icon>
            </button>
            <button
              class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-dim text-muted hover:bg-hover"
            >
              <lc-icon name="bell" class="w-4 h-4"></lc-icon>
            </button>
          </div>
        </header>
        <div class="px-8 pb-8 flex-1 flex flex-col">
          <div class="flex justify-between items-end mb-8">
            <div>
              <h2
                class="text-[28px] font-bold mb-1 tracking-tight text-default"
              >
                Overview
              </h2>
              <p class="text-[13px] text-muted font-medium">
                Welcome back, Rahim. Here is what is happening today.
              </p>
            </div>
            <button
              class="bg-[var(--color-surface-inverse)] text-white px-5 py-2.5 rounded-full text-[13px] font-bold flex items-center gap-2 shadow-sm hover:bg-black transition"
            >
              <lc-icon name="plus" class="w-4 h-4"></lc-icon>
              New Deal
            </button>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div
              class="bg-white border border-dim rounded-[20px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] chart-bg relative"
            >
              <div class="flex justify-between items-center mb-3">
                <span
                  class="text-[11px] font-bold text-muted flex items-center gap-1.5 uppercase tracking-wider"
                  >Total Revenue
                  <lc-icon name="info" class="w-3 h-3 text-disabled"></lc-icon>
                </span>
                <div
                  class="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center border border-dim"
                >
                  <lc-icon
                    name="arrow-up-right"
                    class="w-3.5 h-3.5 text-muted"
                  ></lc-icon>
                </div>
              </div>
              <div
                class="text-[24px] font-bold text-default mb-2 tracking-tight"
              >
                $284,500
                <span class="text-disabled text-sm font-semibold">.00</span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-bold">
                <span
                  class="text-[#F59E0B] bg-[#FFFBEB] border-[#FEF3C7] px-1.5 py-0.5 rounded border"
                  >+12.5%</span
                >
                <span class="text-muted">last month</span>
              </div>
            </div>
            <div
              class="bg-white border border-dim rounded-[20px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] chart-bg relative"
            >
              <div class="flex justify-between items-center mb-3">
                <span
                  class="text-[11px] font-bold text-muted flex items-center gap-1.5 uppercase tracking-wider"
                  >Active Devs
                  <lc-icon name="info" class="w-3 h-3 text-disabled"></lc-icon>
                </span>
                <div
                  class="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center border border-dim"
                >
                  <lc-icon
                    name="arrow-up-right"
                    class="w-3.5 h-3.5 text-muted"
                  ></lc-icon>
                </div>
              </div>
              <div
                class="text-[24px] font-bold text-default mb-2 tracking-tight"
              >
                12.4k
                <span class="text-disabled text-sm font-semibold"> Devs</span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-bold">
                <span
                  class="text-[#10B981] bg-[#ECFDF5] border-[#D1FAE5] px-1.5 py-0.5 rounded border"
                  >+8.1%</span
                >
                <span class="text-muted">New this month</span>
              </div>
            </div>
            <div
              class="bg-white border border-dim rounded-[20px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] chart-bg-down relative"
            >
              <div class="flex justify-between items-center mb-3">
                <span
                  class="text-[11px] font-bold text-muted flex items-center gap-1.5 uppercase tracking-wider"
                  >Open Opportunities
                  <lc-icon name="info" class="w-3 h-3 text-disabled"></lc-icon>
                </span>
                <div
                  class="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center border border-dim"
                >
                  <lc-icon
                    name="arrow-down-right"
                    class="w-3.5 h-3.5 text-muted"
                  ></lc-icon>
                </div>
              </div>
              <div
                class="text-[24px] font-bold text-default mb-2 tracking-tight"
              >
                23
                <span class="text-disabled text-sm font-semibold">.00</span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-bold">
                <span
                  class="text-[#EF4444] bg-[#FEF2F2] border-[#FEE2E2] px-1.5 py-0.5 rounded border"
                  >-2%</span
                >
                <span class="text-muted">Last week</span>
              </div>
            </div>
            <div
              class="bg-white border border-dim rounded-[20px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] chart-bg relative"
            >
              <div class="flex justify-between items-center mb-3">
                <span
                  class="text-[11px] font-bold text-muted flex items-center gap-1.5 uppercase tracking-wider"
                  >Win Rate
                  <lc-icon name="info" class="w-3 h-3 text-disabled"></lc-icon>
                </span>
                <div
                  class="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center border border-dim"
                >
                  <lc-icon
                    name="arrow-up-right"
                    class="w-3.5 h-3.5 text-muted"
                  ></lc-icon>
                </div>
              </div>
              <div
                class="text-[24px] font-bold text-default mb-2 tracking-tight"
              >
                88% <span class="text-disabled text-sm font-semibold"></span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-bold">
                <span
                  class="text-[#10B981] bg-[#ECFDF5] border-[#D1FAE5] px-1.5 py-0.5 rounded border"
                  >+4.2%</span
                >
                <span class="text-muted">last month</span>
              </div>
            </div>
          </div>
          <div class="relative flex-1">
            <div class="opacity-30 blur-[1px] pointer-events-none select-none">
              <h3 class="font-bold text-[14px] mb-4 text-default">
                Recent Opportunities
              </h3>
              <div class="flex gap-4">
                <div
                  class="bg-white rounded-[20px] border border-dim h-28 flex-1"
                ></div>
                <div
                  class="bg-white rounded-[20px] border border-dim h-28 flex-[1.5]"
                ></div>
              </div>
            </div>
            <div
              class="absolute inset-0 bg-gradient-to-t from-[#FDFDFD] via-transparent to-transparent"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const renderHeroDecorations = () => html`
  <div>
    <lc-float-card
      animation="slow"
      hide="md"
      class="-left-8 md:-left-16 top-[30%]"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-full p-2.5 pr-4 flex items-center gap-3 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)_inset] border border-white"
      >
        <div class="bg-[#007AFF] text-white p-1.5 rounded-full">
          <lc-icon name="check" class="w-3.5 h-3.5 stroke-[3]"></lc-icon>
        </div>
        <span class="text-[13.5px] font-bold text-default">Open Source</span>
        <div class="flex -space-x-2.5 pl-1">
          <img
            src="https://i.pravatar.cc/100?img=11"
            class="w-8 h-8 rounded-full border-2 border-white object-cover relative z-10 bg-surface-dark"
            alt=""
          />
          <img
            src="https://i.pravatar.cc/100?img=33"
            class="w-8 h-8 rounded-full border-2 border-white object-cover relative z-20 bg-surface-dark"
            alt=""
          />
          <img
            src="https://i.pravatar.cc/100?img=47"
            class="w-8 h-8 rounded-full border-2 border-white object-cover relative z-30 bg-surface-dark"
            alt=""
          />
          <div
            class="w-8 h-8 rounded-full border-2 border-white bg-[#007AFF] text-white text-[9px] font-bold flex items-center justify-center relative z-40"
          >
            6M+
          </div>
        </div>
      </div>
      <div
        class="absolute -bottom-16 left-6 flex flex-col items-center opacity-50"
      >
        <svg
          width="28"
          height="45"
          viewBox="0 0 24 40"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          class="rotate-12 text-default"
        >
          <path
            d="M12 40C12 30 5 25 5 15C5 5 19 5 19 15C19 20 12 25 12 15M12 15L8 19M12 15L16 19"
          ></path>
        </svg>
        <span
          class="font-[var(--font-handwriting)] text-default text-[22px] -rotate-[10deg] mt-0 -ml-8"
          style="font-family:var(--font-handwriting)"
          >Devs</span
        >
      </div>
    </lc-float-card>
    <lc-float-card
      animation="delayed"
      hide="md"
      class="-bottom-8 left-[10%]"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-[20px] p-5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)_inset] border border-white w-[220px]"
      >
        <h4 class="font-bold text-[15px] text-default mb-0.5">Discovery</h4>
        <p class="text-[12px] text-muted font-medium mb-4">8 deals</p>
        <div
          class="flex justify-between items-end mb-1.5 text-[12px] font-bold"
        >
          <span class="text-default">$1,404</span>
          <span class="text-muted">$42,000</span>
        </div>
        <div class="h-1.5 w-full bg-surface-dark rounded-full overflow-hidden">
          <div class="w-[41%] bg-[var(--color-accent)] h-full rounded-full"></div>
        </div>
        <div class="text-[10px] font-bold text-muted text-right mt-1.5">
          41%
        </div>
      </div>
    </lc-float-card>
    <lc-float-card
      animation="fast"
      hide="lg"
      class="top-[45%] -right-8 md:-right-12"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-full p-2.5 pr-4 flex items-center gap-3 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)_inset] border border-white"
      >
        <div
          class="flex items-center gap-1.5 text-[13px] font-bold text-default pl-2"
        >
          <lc-icon name="globe" class="w-4 h-4 text-muted"></lc-icon>
          Multi-language Support
        </div>
        <div class="flex -space-x-1 mt-0.5">
          <div
            class="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-surface-dark flex items-center justify-center text-xs"
          >
            🇺🇸
          </div>
          <div
            class="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-surface-dark flex items-center justify-center text-xs"
          >
            🇨🇳
          </div>
          <div
            class="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-surface-dark flex items-center justify-center text-xs"
          >
            🇩🇪
          </div>
          <div
            class="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-surface-dark flex items-center justify-center text-xs"
          >
            🇧🇷
          </div>
          <div
            class="w-7 h-7 rounded-full border-2 border-white bg-[var(--color-surface-inverse)] text-white text-[9px] font-bold flex items-center justify-center shadow-sm z-10"
          >
            6M+
          </div>
        </div>
      </div>
    </lc-float-card>
    <lc-float-card
      animation="slow"
      hide="md"
      class="-bottom-12 right-[2%]"
    >
      <div
        class="bg-white/95 backdrop-blur-xl rounded-[20px] p-5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)_inset] border border-white w-[350px]"
      >
        <div class="flex justify-between items-start mb-3">
          <h4
            class="font-bold text-[14px] leading-snug w-[60%] text-default"
          >
            New Release: v1.0
          </h4>
          <span class="text-[13px] font-bold text-default"
            >$15,000 - $25,000</span
          >
        </div>
        <div class="flex justify-between items-center mt-4">
          <div
            class="flex items-center gap-2 text-[10.5px] text-muted font-semibold"
          >
            <span class="flex items-center gap-1.5">
              <lc-icon
                name="rocket"
                class="w-3.5 h-3.5 text-disabled"
              ></lc-icon>
              Startup
            </span>
            <span class="text-disabled">|</span>
            <span class="flex items-center gap-1.5">
              <lc-icon
                name="map-pin"
                class="w-3.5 h-3.5 text-disabled"
              ></lc-icon>
              Remote
            </span>
            <span class="text-disabled">|</span>
            <span class="flex items-center gap-1.5">
              <lc-icon
                name="calendar"
                class="w-3.5 h-3.5 text-disabled"
              ></lc-icon>
              2 days ago
            </span>
          </div>
          <span
            class="text-[10px] font-bold text-[#FF6B6B] bg-danger/10 px-2.5 py-0.5 rounded-full border border-danger/40"
            >High</span
          >
        </div>
      </div>
    </lc-float-card>
    ${renderDashboardMockup()}
  </div>
`;

const renderStep0Mockup = () => html`
  <div>
    <div
      class="bg-white rounded-[20px] border border-dim shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 w-full overflow-hidden"
    >
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FFE66D] flex items-center justify-center text-white font-bold text-sm shadow-sm"
          >
            PF
          </div>
          <div>
            <h5 class="font-bold text-[13px] text-default leading-tight">
              PixelForge Studios
            </h5>
            <p
              class="text-[10px] text-muted font-medium flex items-center gap-1"
            >
              <lc-icon name="map-pin" class="w-3 h-3"></lc-icon>
              Berlin, DE • 12 members
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-2 h-2 rounded-full bg-success-light animate-pulse"></div>
          <span
            class="text-[9px] font-bold text-success uppercase tracking-widest"
            >Online</span
          >
        </div>
      </div>
      <div class="mb-4">
        <p
          class="text-[9px] font-bold text-muted uppercase tracking-widest mb-2"
        >
          Specializations
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all bg-[#2D2D2F] text-white border-[#2D2D2F]"
            >React / Next.js</span
          >
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all bg-[#2D2D2F] text-white border-[#2D2D2F]"
            >UI/UX Design</span
          >
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all bg-white text-muted border-dim"
            >Mobile Apps</span
          >
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all bg-white text-muted border-dim"
            >Branding</span
          >
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all bg-[#2D2D2F] text-white border-[#2D2D2F]"
            >DevOps</span
          >
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <p
            class="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5"
          >
            Deals Won
          </p>
          <p class="text-[16px] font-bold text-default tracking-tight">47</p>
          <p class="text-[9px] font-medium text-muted">+12 this Q</p>
        </div>
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <p
            class="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5"
          >
            Avg. Deal
          </p>
          <p class="text-[16px] font-bold text-default tracking-tight">
            $18.5k
          </p>
          <p class="text-[9px] font-medium text-muted">↑ 23%</p>
        </div>
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <p
            class="text-[9px] font-bold text-muted uppercase tracking-wider mb-0.5"
          >
            Rating
          </p>
          <p class="text-[16px] font-bold text-default tracking-tight">4.9</p>
          <p class="text-[9px] font-medium text-muted">★★★★★</p>
        </div>
      </div>
      <div
        class="mt-4 bg-gradient-to-r from-[#ECFDF5] to-[#F0FDF4] rounded-xl p-3 border border-success/40"
      >
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] font-bold text-success-dark"
            >Profile Completeness</span
          >
          <span class="text-[10px] font-bold text-success">92%</span>
        </div>
        <div class="h-1.5 bg-success/20 rounded-full overflow-hidden">
          <div class="w-[92%] h-full bg-success rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
`;

const renderStep1Mockup = () => html`
  <div>
    <div
      class="bg-white rounded-[20px] border border-dim shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 w-full overflow-hidden"
    >
      <div class="flex items-center gap-2 mb-4">
        <div class="flex-1 relative">
          <lc-icon
            name="search"
            class="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2"
          ></lc-icon>
          <div
            class="bg-[#F8F8F6] rounded-full py-2 pl-8 pr-3 text-[11px] text-muted font-medium border border-dim"
          >
            Search components…
          </div>
        </div>
        <div class="bg-[#2D2D2F] text-white p-2 rounded-xl cursor-pointer">
          <lc-icon name="sparkles" class="w-4 h-4"></lc-icon>
        </div>
      </div>
      <div class="flex items-center gap-2 mb-3.5">
        <div
          class="flex items-center gap-1.5 bg-secondary/10 px-2.5 py-1 rounded-full border border-secondary/40"
        >
          <lc-icon
            name="sparkles"
            class="w-3 h-3 text-secondary"
          ></lc-icon>
          <span
            class="text-[9px] font-bold text-secondary uppercase tracking-wider"
            >AI Matched</span
          >
        </div>
        <span class="text-[10px] text-muted font-medium"
          >3 matching components found</span
        >
      </div>
      <div class="flex flex-col gap-2.5">
        <div
          class="flex items-center gap-3 p-3 rounded-2xl border transition-all bg-[#F8F7F4] border-dim shadow-sm"
        >
          <img
            src="https://i.pravatar.cc/100?img=12"
            class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
            style="width:38px;height:38px"
            alt=""
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[12px] font-bold text-default truncate"
                >lc-button</span
              >
              <span
                class="text-[8px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full border border-warning/40"
                >⚡ TOP MATCH</span
              >
            </div>
            <p
              class="text-[10px] text-muted font-medium flex items-center gap-1"
            >
              <lc-icon name="map-pin" class="w-2.5 h-2.5"></lc-icon>
              display
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <div
              class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/40"
            >
              97%
            </div>
          </div>
        </div>
        <div
          class="flex items-center gap-3 p-3 rounded-2xl border transition-all bg-white border-dim hover:bg-[#FAFAF8]"
        >
          <img
            src="https://i.pravatar.cc/100?img=9"
            class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
            style="width:38px;height:38px"
            alt=""
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[12px] font-bold text-default truncate"
                >lc-card</span
              >
            </div>
            <p
              class="text-[10px] text-muted font-medium flex items-center gap-1"
            >
              <lc-icon name="map-pin" class="w-2.5 h-2.5"></lc-icon>
              layout
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <div
              class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/40"
            >
              94%
            </div>
          </div>
        </div>
        <div
          class="flex items-center gap-3 p-3 rounded-2xl border transition-all bg-white border-dim hover:bg-[#FAFAF8]"
        >
          <img
            src="https://i.pravatar.cc/100?img=15"
            class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
            style="width:38px;height:38px"
            alt=""
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[12px] font-bold text-default truncate"
                >lc-modal</span
              >
            </div>
            <p
              class="text-[10px] text-muted font-medium flex items-center gap-1"
            >
              <lc-icon name="map-pin" class="w-2.5 h-2.5"></lc-icon>
              overlay
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <div
              class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-light text-secondary border border-dim"
            >
              89%
            </div>
          </div>
        </div>
      </div>
      <div class="mt-4 bg-[#FAFAF8] rounded-xl p-3.5 border border-dim">
        <p
          class="text-[9px] font-bold text-muted uppercase tracking-widest mb-2.5"
        >
          Component Details: lc-button
        </p>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold text-muted w-14 shrink-0"
              >Props</span
            >
            <div class="flex-1 h-1.5 bg-surface-dark rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-success"
                style="width:98%"
              ></div>
            </div>
            <span
              class="text-[10px] font-bold text-secondary w-8 text-right"
              >98%</span
            >
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold text-muted w-14 shrink-0"
              >Slots</span
            >
            <div class="flex-1 h-1.5 bg-surface-dark rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-info"
                style="width:95%"
              ></div>
            </div>
            <span
              class="text-[10px] font-bold text-secondary w-8 text-right"
              >95%</span
            >
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold text-muted w-14 shrink-0"
              >Theme</span
            >
            <div class="flex-1 h-1.5 bg-surface-dark rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-secondary"
                style="width:100%"
              ></div>
            </div>
            <span
              class="text-[10px] font-bold text-secondary w-8 text-right"
              >100%</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const renderStep2Mockup = () => html`
  <div>
    <div
      class="bg-white rounded-[20px] border border-dim shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 w-full overflow-hidden"
    >
      <div class="flex justify-between items-center mb-4">
        <div>
          <h5 class="font-bold text-[13px] text-default">Deal Pipeline</h5>
          <p class="text-[10px] text-muted font-medium">
            Q1 2026 • 12 active deals
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            <img
              src="https://i.pravatar.cc/100?img=11"
              class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
              style="width:26px;height:26px"
              alt=""
            />
            <img
              src="https://i.pravatar.cc/100?img=33"
              class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
              style="width:26px;height:26px"
              alt=""
            />
            <img
              src="https://i.pravatar.cc/100?img=5"
              class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
              style="width:26px;height:26px"
              alt=""
            />
          </div>
          <div
            class="w-6 h-6 rounded-full bg-surface-dark border border-dim flex items-center justify-center text-muted text-[10px] font-bold"
          >
            +5
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <div class="flex items-center gap-1.5 mb-2">
            <div class="w-2 h-2 rounded-full bg-warning"></div>
            <span
              class="text-[9px] font-bold text-muted uppercase tracking-wider"
              >Discovery</span
            >
          </div>
          <p class="text-[17px] font-bold text-default tracking-tight">$42k</p>
          <p class="text-[9px] text-muted font-medium">5 deals</p>
        </div>
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <div class="flex items-center gap-1.5 mb-2">
            <div class="w-2 h-2 rounded-full bg-info"></div>
            <span
              class="text-[9px] font-bold text-muted uppercase tracking-wider"
              >Proposal</span
            >
          </div>
          <p class="text-[17px] font-bold text-default tracking-tight">$68k</p>
          <p class="text-[9px] text-muted font-medium">4 deals</p>
        </div>
        <div class="bg-[#FAFAF8] rounded-xl p-3 border border-dim">
          <div class="flex items-center gap-1.5 mb-2">
            <div class="w-2 h-2 rounded-full bg-success"></div>
            <span
              class="text-[9px] font-bold text-muted uppercase tracking-wider"
              >Won</span
            >
          </div>
          <p class="text-[17px] font-bold text-default tracking-tight">$85k</p>
          <p class="text-[9px] text-muted font-medium">3 deals</p>
        </div>
      </div>
      <div
        class="bg-gradient-to-r from-[#2D2D2F] to-[#3A3A3C] rounded-2xl p-4 text-white"
      >
        <div class="flex justify-between items-start mb-3">
          <div>
            <p
              class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1"
            >
              Latest Won Deal
            </p>
            <h5 class="font-bold text-[14px] leading-snug">
              E-Commerce Platform Redesign
            </h5>
          </div>
          <span
            class="text-[9px] font-bold bg-success/20 text-success-light px-2 py-0.5 rounded-full border border-success/20"
            >CLOSED WON</span
          >
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex -space-x-2">
              <img
                src="https://i.pravatar.cc/100?img=12"
                class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
                style="width:24px;height:24px"
                alt=""
              />
              <img
                src="https://i.pravatar.cc/100?img=47"
                class="rounded-full object-cover bg-surface-dark border-2 border-white shadow-sm"
                style="width:24px;height:24px"
                alt=""
              />
            </div>
            <div
              class="flex items-center gap-1.5 text-[10px] text-white/50 font-medium"
            >
              <lc-icon name="handshake" class="w-3 h-3"></lc-icon>
              Cloudflare Workers deployment
            </div>
          </div>
          <span class="text-[18px] font-bold tracking-tight">$24,500</span>
        </div>
      </div>
      <div
        class="mt-3 flex items-center justify-between bg-[#FAFAF8] rounded-xl p-3 border border-dim"
      >
        <div class="flex items-center gap-2">
          <lc-icon
            name="trending-up"
            class="w-4 h-4 text-success"
          ></lc-icon>
          <span class="text-[11px] font-bold text-secondary"
            >Revenue this quarter</span
          >
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[14px] font-bold text-default">$195,000</span>
          <span
            class="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/40"
            >+34%</span
          >
        </div>
      </div>
    </div>
  </div>
`;

/** @type {SamplePage} */
export default {
  header: { type: "lc-site-header", props: SITE_HEADER },
  footer: { type: "lc-footer", props: FOOTER },
  sections: [
    {
      type: "lc-hero-section",
      props: { ...HERO, decorations: renderHeroDecorations() },
    },
    {
      type: "lc-steps-section",
      props: {
        ...STEPS,
        sectionId: "how-it-works",
        stepMockups: [
          renderStep0Mockup(),
          renderStep1Mockup(),
          renderStep2Mockup(),
        ],
      },
    },
    {
      type: "lc-feature-grid",
      props: { ...FEATURES, sectionId: "features", variant: "dark" },
    },
    {
      type: "lc-testimonial-section",
      props: { ...TESTIMONIALS, sectionId: "testimonials" },
    },
    { type: "lc-faq-section", props: { ...FAQ, sectionId: "faq" } },
    { type: "lc-cta-section", props: { ...CTA, variant: "dark" } },
  ],
};
