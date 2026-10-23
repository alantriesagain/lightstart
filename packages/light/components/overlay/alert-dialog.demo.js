import { html } from "@bootstrapp/light/html";

export default {
  description: "A modal that asks before something irreversible, and returns the answer.",
  slot: () => html`<p>Are you sure you want to proceed?</p>`,
  preview: () => html`
    <div class="p-3" style="background: var(--color-surface-dark)">
      <lc-card padding="sm"><lc-text weight="semibold">Delete this file?</lc-text><lc-text size="xs" muted>This cannot be undone.</lc-text>
        <div class="flex gap-2 justify-end"><lc-button size="xs">Cancel</lc-button><lc-button size="xs" danger>Delete</lc-button></div></lc-card>
    </div>
  `,
  examples: [
    {
      title: "Success",
      render: () => html`
        <lc-alert-dialog
          title="Success!"
          message="Your changes have been saved successfully."
          variant="success"
          confirm-text="Great!"
        ></lc-alert-dialog>
      `,
    },
    {
      title: "Warning",
      render: () => html`
        <lc-alert-dialog
          title="Warning"
          message="Your session is about to expire. Would you like to continue?"
          variant="warning"
          show-cancel
          confirm-text="Continue"
          cancel-text="Logout"
        ></lc-alert-dialog>
      `,
    },
    {
      title: "Info",
      render: () => html`
        <lc-alert-dialog
          title="New Features"
          message="Check out our latest updates and improvements!"
          variant="info"
          confirm-text="Learn More"
        ></lc-alert-dialog>
      `,
    },
    {
      title: "Custom content",
      render: () => html`
        <lc-alert-dialog title="Custom Content" variant="info">
          <p>This dialog can contain any HTML content:</p>
          <ul>
            <li>Bullet points</li>
            <li>Links</li>
            <li>Images</li>
          </ul>
          <img src="/image.jpg" alt="Example" style="max-width: 100%;">
        </lc-alert-dialog>
      `,
    },
    {
      title: "Close on backdrop click",
      render: () => html`
        <lc-alert-dialog
          title="Click Outside to Close"
          message="This dialog will close when you click the backdrop."
          close-on-backdrop-click
        ></lc-alert-dialog>
      `,
    },
  ],
};
