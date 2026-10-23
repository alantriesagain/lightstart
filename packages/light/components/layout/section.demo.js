import { html } from "@bootstrapp/light/html";

export default {
  description: "One band of a page, with its own background and vertical padding.",
  slot: () => html`
    <lc-text level="2" size="xl">Section Title</lc-text>
    <p>Section content paragraph.</p>
  `,
  preview: () => html`
    <lc-section padding="lg" centered style="background: var(--color-surface-lighter)">
      <lc-text level="2" size="2xl" weight="bold">Built for the whole page</lc-text>
      <p>One band of content, with its own background and vertical rhythm.</p>
      <lc-button primary>Get started</lc-button>
    </lc-section>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-section>
          <h2>Section Title</h2>
          <p>Section content goes here...</p>
        </lc-section>
      `,
    },
    {
      title: "Centered content",
      render: () => html`
        <lc-section centered>
          <h2>Centered Section</h2>
          <p>This content is centered within the section.</p>
        </lc-section>
      `,
    },
    {
      title: "Padding variants",
      render: () => html`
        <div>
          <lc-section padding="none" style="background: #f0f0f0;">
            <h3>No Padding</h3>
          </lc-section>

          <lc-section padding="sm" style="background: #e0e0e0;">
            <h3>Small Padding</h3>
          </lc-section>

          <lc-section padding="lg" style="background: #d0d0d0;">
            <h3>Large Padding</h3>
          </lc-section>

          <lc-section padding="xl" style="background: #c0c0c0;">
            <h3>Extra Large Padding</h3>
          </lc-section>
        </div>
      `,
    },
    {
      title: "Max width variants",
      render: () => html`
        <div>
          <lc-section max-width="sm" style="background: #f5f5f5;">
            <h3>Small Container</h3>
            <p>Content is constrained to a small width.</p>
          </lc-section>

          <lc-section max-width="xl" style="background: #e5e5e5;">
            <h3>Extra Large Container</h3>
            <p>Content can span a wider area.</p>
          </lc-section>

          <lc-section max-width="full" style="background: #d5d5d5;">
            <h3>Full Width</h3>
            <p>Content spans the full viewport width.</p>
          </lc-section>
        </div>
      `,
    },
    {
      title: "Landing page",
      render: () => html`
        <lc-section padding="xl" centered style="background: linear-gradient(to right, #667eea, #764ba2); color: white;">
          <h1 style="font-size: 3rem; margin-bottom: 1rem;">Welcome to Our Product</h1>
          <p style="font-size: 1.25rem; margin-bottom: 2rem;">The best solution for your needs</p>
          <lc-button variant="primary" size="lg">Get Started</lc-button>
        </lc-section>

        <lc-section padding="lg">
          <h2 style="text-align: center; margin-bottom: 3rem;">Features</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
            <lc-panel variant="elevated" centered>
              <lc-icon name="zap" size="xl"></lc-icon>
              <h3>Fast</h3>
              <p>Lightning fast performance</p>
            </lc-panel>
            <lc-panel variant="elevated" centered>
              <lc-icon name="shield" size="xl"></lc-icon>
              <h3>Secure</h3>
              <p>Enterprise-grade security</p>
            </lc-panel>
            <lc-panel variant="elevated" centered>
              <lc-icon name="trending-up" size="xl"></lc-icon>
              <h3>Scalable</h3>
              <p>Grows with your business</p>
            </lc-panel>
          </div>
        </lc-section>

        <lc-section padding="xl" centered style="background: #f7fafc;">
          <h2>Ready to get started?</h2>
          <p>Join thousands of satisfied customers today.</p>
          <lc-button variant="primary" size="lg">Sign Up Now</lc-button>
        </lc-section>
      `,
    },
    {
      title: "Content",
      render: () => html`
        <div>
          <lc-section>
            <h2>Introduction</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
          </lc-section>

          <lc-section style="background: #f9f9f9;">
            <h2>Features</h2>
            <ul>
              <li>Feature 1</li>
              <li>Feature 2</li>
              <li>Feature 3</li>
            </ul>
          </lc-section>

          <lc-section>
            <h2>Pricing</h2>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
              <lc-panel variant="bordered">
                <h3>Basic</h3>
                <p>$9/month</p>
              </lc-panel>
              <lc-panel variant="bordered">
                <h3>Pro</h3>
                <p>$29/month</p>
              </lc-panel>
              <lc-panel variant="bordered">
                <h3>Enterprise</h3>
                <p>$99/month</p>
              </lc-panel>
            </div>
          </lc-section>
        </div>
      `,
    },
  ],
};
