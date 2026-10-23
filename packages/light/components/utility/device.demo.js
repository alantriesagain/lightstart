import { html } from "@bootstrapp/light/html";

export default {
  description: "What the device is, as props other components can render against.",
  preview: () => html`
    <lc-device width="375px" height="460px">
      <lc-app-container layout="mobile">
        <lc-app-header slot="header">
          <lc-text level="3">My App</lc-text>
        </lc-app-header>
        <p>App content here</p>
      </lc-app-container>
    </lc-device>
  `,
  previewWidth: 960,
  examples: [
    {
      title: "Basic iphone frame",
      render: () => html`
        <lc-device>
          <lc-app-container layout="mobile">
            <lc-app-header slot="header">
              <lc-text level="3">My App</lc-text>
            </lc-app-header>
            <p>App content here</p>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Android",
      render: () => html`
        <lc-device device="android" width="360px" height="740px">
          <lc-app-container layout="mobile">
            <p>Android app example</p>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Ipad frame",
      render: () => html`
        <lc-device device="ipad" width="768px" height="1024px">
          <lc-app-container layout="tablet">
            <p>iPad app example</p>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Without notch/controls",
      render: () => html`
        <lc-device
          device="iphone"
          showNotch={false}
          showControls={false}
        >
          <lc-app-container layout="mobile">
            <p>Clean frame without iPhone UI elements</p>
          </lc-app-container>
        </lc-device>
      `,
    },
    {
      title: "Scaled for demo",
      render: () => html`
        <lc-device scale="0.8">
          <lc-app-container layout="mobile">
            <p>80% scale for fitting in smaller spaces</p>
          </lc-app-container>
        </lc-device>
      `,
    },
  ],
};
