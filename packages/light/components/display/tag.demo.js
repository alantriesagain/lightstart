import { html } from "@bootstrapp/light/html";

export default {
  description: "A short label a reader can dismiss, for a filter or a chip.",
  slot: () => "Tag",
  preview: () => html`
    <lc-flex gap="sm" wrap="wrap">
      <lc-tag variant="primary" closable>React</lc-tag>
      <lc-tag variant="success" count="12">javascript</lc-tag>
      <lc-tag outlined>Draft</lc-tag>
    </lc-flex>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <lc-tag>Default</lc-tag>
          <lc-tag variant="primary">Primary</lc-tag>
          <lc-tag variant="secondary">Secondary</lc-tag>
          <lc-tag variant="success">Success</lc-tag>
          <lc-tag variant="warning">Warning</lc-tag>
          <lc-tag variant="error">Error</lc-tag>
          <lc-tag variant="info">Info</lc-tag>
        </div>
      `,
    },
    {
      title: "Outlined",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <lc-tag outlined>Default</lc-tag>
          <lc-tag variant="primary" outlined>Primary</lc-tag>
          <lc-tag variant="success" outlined>Success</lc-tag>
          <lc-tag variant="error" outlined>Error</lc-tag>
        </div>
      `,
    },
    {
      title: "Size variants",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <lc-tag size="sm" variant="primary">Small</lc-tag>
          <lc-tag size="md" variant="primary">Medium</lc-tag>
          <lc-tag size="lg" variant="primary">Large</lc-tag>
        </div>
      `,
    },
    {
      title: "Counts",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <lc-tag count="12">javascript</lc-tag>
          <lc-tag variant="primary" count="3">frameworks</lc-tag>
          <lc-tag outlined count="47">notes</lc-tag>
        </div>
      `,
    },
    {
      title: "Closable",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <lc-tag closable variant="primary">React</lc-tag>
          <lc-tag closable variant="secondary">Vue</lc-tag>
          <lc-tag closable variant="success">Svelte</lc-tag>
        </div>
      `,
    },
    {
      title: "Icons",
      render: () => html`
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <lc-tag variant="primary">
            <lc-icon name="tag" slot="icon"></lc-icon>
            Label
          </lc-tag>
          <lc-tag variant="success">
            <lc-icon name="check" slot="icon"></lc-icon>
            Verified
          </lc-tag>
          <lc-tag variant="warning">
            <lc-icon name="triangle-alert" slot="icon"></lc-icon>
            Warning
          </lc-tag>
        </div>
      `,
    },
    {
      title: "Not rounded",
      render: () => html`
        <div style="display: flex; gap: 0.5rem;">
          <lc-tag variant="primary" rounded="false">Square Tag</lc-tag>
          <lc-tag variant="success" rounded="false" outlined>Outlined Square</lc-tag>
        </div>
      `,
    },
    {
      title: "Product",
      render: () => html`
        <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
          <h3>Wireless Headphones</h3>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
            <lc-tag variant="success" size="sm">
              <lc-icon name="check" slot="icon"></lc-icon>
              In Stock
            </lc-tag>
            <lc-tag variant="error" size="sm">Hot</lc-tag>
            <lc-tag variant="info" size="sm">Free Shipping</lc-tag>
            <lc-tag size="sm" outlined>Electronics</lc-tag>
          </div>
        </div>
      `,
    },
    {
      title: "User skills",
      render: () => html`
        <div>
          <h4>Skills:</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            <lc-tag closable>JavaScript</lc-tag>
            <lc-tag closable>TypeScript</lc-tag>
            <lc-tag closable>React</lc-tag>
            <lc-tag closable>Node.js</lc-tag>
            <lc-tag closable>Python</lc-tag>
          </div>
        </div>
      `,
    },
    {
      title: "Filter",
      render: () => html`
        <div>
          <h4>Active Filters:</h4>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
            <lc-tag closable variant="primary" size="sm">Category: Books</lc-tag>
            <lc-tag closable variant="primary" size="sm">Price: $10-$50</lc-tag>
            <lc-tag closable variant="primary" size="sm">Rating: 4+</lc-tag>
          </div>
        </div>
      `,
    },
    {
      title: "Status badges",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Order #12345</span>
            <lc-tag variant="success" size="sm">Delivered</lc-tag>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Order #12346</span>
            <lc-tag variant="info" size="sm">Processing</lc-tag>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Order #12347</span>
            <lc-tag variant="error" size="sm">Cancelled</lc-tag>
          </div>
        </div>
      `,
    },
    {
      title: "Disabled state",
      render: () => html`
        <div style="display: flex; gap: 0.5rem;">
          <lc-tag disabled>Disabled</lc-tag>
          <lc-tag closable disabled variant="primary">Disabled Closable</lc-tag>
        </div>
      `,
    },
  ],
};
