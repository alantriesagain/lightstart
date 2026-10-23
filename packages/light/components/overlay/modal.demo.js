import { html } from "@bootstrapp/light/html";

export default {
  description: "A dialog over the page, with the scroll locked behind it.",
  slot: () => html`
    <div slot="header">Modal Title</div>
    <p>Modal body content goes here. You can put any content inside.</p>
    <div slot="footer">
      <lc-button>Cancel</lc-button>
      <lc-button variant="primary">Confirm</lc-button>
    </div>
  `,
  preview: () => html`
    <div class="p-3" style="background: var(--color-surface-dark)">
      <lc-card padding="sm"><lc-text weight="semibold">Invite a teammate</lc-text><lc-text size="xs" muted>They will get an email with a link.</lc-text>
        <div class="flex gap-2 justify-end"><lc-button size="xs">Cancel</lc-button><lc-button size="xs" primary>Send</lc-button></div></lc-card>
    </div>
  `,
  examples: [
    {
      title: "Opened by a trigger",
      render: () => html`
        <lc-modal>
          <lc-button slot="trigger" primary>Open modal</lc-button>
          <h2 slot="header">Modal Title</h2>
          <p>Modal content goes here...</p>
          <div slot="footer">
            <lc-button data-close>Cancel</lc-button>
            <lc-button variant="primary">Confirm</lc-button>
          </div>
        </lc-modal>
      `,
    },
    {
      title: "A sheet over the page",
      render: () => html`
        <lc-modal variant="sheet" size="sm">
          <lc-button slot="trigger" primary>Sign in</lc-button>
          <h2 slot="header">Sign in to post your meetup</h2>
          <lc-button border wFull>Continue with email</lc-button>
        </lc-modal>
      `,
    },
  ],
};
