import { html } from "@bootstrapp/light/html";

export default {
  description: "A responsive grid: the column count is a breakpoint map, not a media query you write.",
  slot: () => html`
    <lc-card variant="filled" padding="md">Cell 1</lc-card>
    <lc-card variant="filled" padding="md">Cell 2</lc-card>
    <lc-card variant="filled" padding="md">Cell 3</lc-card>
    <lc-card variant="filled" padding="md">Cell 4</lc-card>
  `,
  preview: () => html`
    <lc-grid columns="2" gap="xs" style="width: 150px">
      <lc-container variant="filled" padding="sm">A</lc-container>
      <lc-container variant="filled" padding="sm">B</lc-container>
      <lc-container variant="filled" padding="sm">C</lc-container>
      <lc-container variant="filled" padding="sm">D</lc-container>
    </lc-grid>
  `,
  examples: [
    {
      title: "Basic auto-fit",
      render: () => html`
        <lc-grid>
          <lc-panel variant="bordered">Item 1</lc-panel>
          <lc-panel variant="bordered">Item 2</lc-panel>
          <lc-panel variant="bordered">Item 3</lc-panel>
          <lc-panel variant="bordered">Item 4</lc-panel>
        </lc-grid>
      `,
    },
    {
      title: "Fixed number of columns",
      render: () => html`
        <lc-grid columns="3">
          <lc-panel variant="bordered">Item 1</lc-panel>
          <lc-panel variant="bordered">Item 2</lc-panel>
          <lc-panel variant="bordered">Item 3</lc-panel>
          <lc-panel variant="bordered">Item 4</lc-panel>
          <lc-panel variant="bordered">Item 5</lc-panel>
          <lc-panel variant="bordered">Item 6</lc-panel>
        </lc-grid>
      `,
    },
    {
      title: "Custom minimum column width",
      render: () => html`
        <lc-grid min-column-width="150px">
          <lc-panel variant="bordered">Small 1</lc-panel>
          <lc-panel variant="bordered">Small 2</lc-panel>
          <lc-panel variant="bordered">Small 3</lc-panel>
          <lc-panel variant="bordered">Small 4</lc-panel>
          <lc-panel variant="bordered">Small 5</lc-panel>
          <lc-panel variant="bordered">Small 6</lc-panel>
        </lc-grid>
      `,
    },
    {
      title: "Gap variants",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <div>
            <p>Small gap:</p>
            <lc-grid columns="3" gap="sm">
              <div style="background: #ddd; padding: 1rem;">Item 1</div>
              <div style="background: #ddd; padding: 1rem;">Item 2</div>
              <div style="background: #ddd; padding: 1rem;">Item 3</div>
            </lc-grid>
          </div>

          <div>
            <p>Large gap:</p>
            <lc-grid columns="3" gap="lg">
              <div style="background: #ddd; padding: 1rem;">Item 1</div>
              <div style="background: #ddd; padding: 1rem;">Item 2</div>
              <div style="background: #ddd; padding: 1rem;">Item 3</div>
            </lc-grid>
          </div>
        </div>
      `,
    },
    {
      title: "Dashboard",
      render: () => html`
        <lc-grid columns="4" gap="md">
          <lc-panel variant="elevated">
            <h4>Total Users</h4>
            <p style="font-size: 2rem; font-weight: bold;">1,234</p>
          </lc-panel>
          <lc-panel variant="elevated">
            <h4>Revenue</h4>
            <p style="font-size: 2rem; font-weight: bold;">$45K</p>
          </lc-panel>
          <lc-panel variant="elevated">
            <h4>Orders</h4>
            <p style="font-size: 2rem; font-weight: bold;">567</p>
          </lc-panel>
          <lc-panel variant="elevated">
            <h4>Sessions</h4>
            <p style="font-size: 2rem; font-weight: bold;">890</p>
          </lc-panel>
        </lc-grid>
      `,
    },
    {
      title: "Image gallery",
      render: () => html`
        <lc-grid min-column-width="150px" gap="xs">
          <img src="/image1.jpg" alt="Image 1" style="width: 100%; height: 150px; object-fit: cover;">
          <img src="/image2.jpg" alt="Image 2" style="width: 100%; height: 150px; object-fit: cover;">
          <img src="/image3.jpg" alt="Image 3" style="width: 100%; height: 150px; object-fit: cover;">
          <img src="/image4.jpg" alt="Image 4" style="width: 100%; height: 150px; object-fit: cover;">
          <img src="/image5.jpg" alt="Image 5" style="width: 100%; height: 150px; object-fit: cover;">
          <img src="/image6.jpg" alt="Image 6" style="width: 100%; height: 150px; object-fit: cover;">
        </lc-grid>
      `,
    },
    {
      title: "Feature cards",
      render: () => html`
        <lc-grid columns="3" gap="xl">
          <lc-panel variant="bordered" style="text-align: center;">
            <lc-icon name="zap" size="xl" style="color: var(--color-primary);"></lc-icon>
            <h3>Fast</h3>
            <p>Lightning fast performance for all your needs.</p>
          </lc-panel>

          <lc-panel variant="bordered" style="text-align: center;">
            <lc-icon name="shield" size="xl" style="color: var(--color-success);"></lc-icon>
            <h3>Secure</h3>
            <p>Enterprise-grade security you can trust.</p>
          </lc-panel>

          <lc-panel variant="bordered" style="text-align: center;">
            <lc-icon name="trending-up" size="xl" style="color: var(--color-info);"></lc-icon>
            <h3>Scalable</h3>
            <p>Grows seamlessly with your business.</p>
          </lc-panel>
        </lc-grid>
      `,
    },
    {
      title: "Responsive columns",
      render: () => html`
        <lc-grid style="--grid-columns: 1;" gap="md">
          <lc-panel variant="bordered">Mobile: 1 column</lc-panel>
          <lc-panel variant="bordered">Mobile: 1 column</lc-panel>
        </lc-grid>

        <style>
          @media (min-width: 768px) {
            lc-grid {
              --grid-columns: 2;
            }
          }
          @media (min-width: 1024px) {
            lc-grid {
              --grid-columns: 3;
            }
          }
        </style>
      `,
    },
  ],
};
