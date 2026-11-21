import { html } from "@lightstart/light/html";

export default {
  description: "A settings line: a label and description beside the control that changes them.",
  preview: () => html`
    <lc-panel padding="none" style="width: 220px">
      <lc-setting-row icon="bell" label="Notifications" description="Mentions and replies">
        <lc-switch checked></lc-switch>
      </lc-setting-row>
    </lc-panel>
  `,
  examples: [
    {
      title: "A settings group",
      description: "A switch, a select and a button, each in its own row.",
      render: () => html`
        <lc-panel padding="none" style="max-width: 520px">
          <lc-setting-row icon="bell" label="Notifications" description="Mentions, replies and new followers.">
            <lc-switch checked></lc-switch>
          </lc-setting-row>
          <lc-setting-row icon="globe" label="Language" description="The words the app draws.">
            <lc-select value="English" options='["English", "Português", "Español"]'></lc-select>
          </lc-setting-row>
          <lc-setting-row icon="trash-2" label="Delete account" description="Removes everything, for good.">
            <lc-button variant="danger">Delete</lc-button>
          </lc-setting-row>
        </lc-panel>
      `,
    },
    {
      title: "Rich label and description",
      render: () => html`
        <lc-panel padding="none" style="max-width: 520px">
          <lc-setting-row icon="shield">
            <span slot="label"><strong>Two-factor</strong> authentication</span>
            <span slot="description">A code from <a href="/security/authenticator">your authenticator</a>.</span>
            <lc-switch></lc-switch>
          </lc-setting-row>
        </lc-panel>
      `,
    },
  ],
};
