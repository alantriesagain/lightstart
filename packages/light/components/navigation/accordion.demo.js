import { html } from "@bootstrapp/light/html";

export default {
  description: "Sections that open one at a time, or several at once.",
  slot: () => html`
    <lc-nav-item label="Section 1" icon="chevron-right"></lc-nav-item>
    <div style="padding: 12px;">Accordion content for section 1</div>
    <lc-nav-item label="Section 2" icon="chevron-right"></lc-nav-item>
    <div style="padding: 12px;">Accordion content for section 2</div>
  `,
  preview: () => html`
    <lc-accordion variant="bordered">
      <button open>Profile</button>
      <div>Name, photo and bio</div>
      <button>Settings</button>
      <div>General settings</div>
    </lc-accordion>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-accordion>
          <button>Section 1</button>
          <div>Content for section 1</div>
          <button>Section 2</button>
          <div>Content for section 2</div>
        </lc-accordion>
      `,
    },
    {
      title: "Bordered with initial open",
      render: () => html`
        <lc-accordion variant="bordered">
          <button open>Open by default</button>
          <div>This panel starts open</div>
          <button>Closed</button>
          <div>This panel starts closed</div>
        </lc-accordion>
      `,
    },
    {
      title: "Single mode",
      render: () => html`
        <lc-accordion single variant="filled">
          <button>Profile</button>
          <div>Profile settings content</div>
          <button>Settings</button>
          <div>General settings content</div>
        </lc-accordion>
      `,
    },
  ],
};
