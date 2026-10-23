import { html } from "@bootstrapp/light/html";

export default {
  description: "A panel from any edge, dismissed by a swipe or by Escape.",
  slot: () => html`
    <lc-text level="3" size="lg" style="margin-bottom: 16px;">Drawer</lc-text>
    <p>Drawer content slides in from the side.</p>
  `,
  preview: () => html`
    <div class="flex justify-end" style="background: var(--color-surface-dark); height: 100px">
      <lc-panel variant="elevated" padding="sm" style="width: 55%"><div class="flex flex-col gap-2"><lc-text weight="semibold">Settings</lc-text>
        <lc-text size="xs" muted>Username</lc-text><lc-button size="xs" primary>Save</lc-button></div></lc-panel>
    </div>
  `,
  examples: [
    {
      title: "Right sidebar",
      render: () => html`
        <lc-drawer position="right" width="350px">
          <div style="padding: 2rem;">
            <lc-text level="3">Settings</lc-text>
            <lc-form>
              <lc-input label="Username"></lc-input>
              <lc-input label="Email" type="email"></lc-input>
              <lc-button primary w-full>Save</lc-button>
            </lc-form>
          </div>
        </lc-drawer>
      `,
    },
    {
      title: "From the bottom",
      render: () => html`
        <lc-drawer position="bottom" height="60vh">
          <div style="padding: 2rem;">
            <lc-text level="3">Filter Options</lc-text>
            <lc-flex direction="column" gap="md">
              <lc-checkbox label="In Stock"></lc-checkbox>
              <lc-checkbox label="On Sale"></lc-checkbox>
              <lc-checkbox label="Free Shipping"></lc-checkbox>
              <lc-button primary w-full>Apply Filters</lc-button>
            </lc-flex>
          </div>
        </lc-drawer>
      `,
    },
    {
      title: "Responsive",
      render: () => html`
        <style>
          @media (min-width: 992px) {
            #mobile-drawer {
              display: none;
            }
          }
        </style>

        <lc-drawer id="mobile-drawer">
          <lc-sidebar>Mobile navigation</lc-sidebar>
        </lc-drawer>
      `,
    },
  ],
};
