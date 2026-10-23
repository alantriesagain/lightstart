import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-device",

  props: {
    device: T.string({
      defaultValue: "iphone",
      enum: ["iphone", "android", "ipad", "desktop"],
    }),
    width: "375px",
    height: "812px",
    scale: "1",
    showNotch: true,
    showControls: true,
  },

  style: true,

  updated() {
    this.style.setProperty("--device-width", this.width);
    this.style.setProperty("--device-height", this.height);
    this.style.setProperty("--device-scale", this.scale);
  },

  render() {
    return html`

      <div part="lc-device-container" class="device-container">
        <div part="lc-device-screen" class="device-screen">
          ${
            this.showNotch && this.device === "iphone"
              ? html`<div part="lc-device-notch" class="device-notch"></div>`
              : ""
          }

          <slot></slot>

          ${
            this.showControls && this.device === "iphone"
              ? html`<div part="lc-device-home-indicator" class="device-home-indicator"></div>`
              : ""
          }
        </div>
      </div>
    `;
  },
});

/**
 * Device Frame Component
 *
 * @component
 * @category utility
 * @tag lc-device
 *
 * A device simulator component that wraps content in a realistic phone/tablet mockup.
 * Perfect for displaying app examples, demos, and screenshots in a professional way.
 *
 * @property {string} device - Device type: iphone, android, ipad, desktop (default: iphone)
 * @property {string} width - Device width (default: 375px for iPhone)
 * @property {string} height - Device height (default: 812px for iPhone)
 * @property {string} scale - Scale factor for responsive sizing (default: 1)
 * @property {boolean} showNotch - Show iPhone notch (default: true)
 * @property {boolean} showControls - Show home indicator/controls (default: true)
 *
 * @part container - The device outer frame
 * @part screen - The device screen area
 * @part notch - The iPhone notch element
 * @part home-indicator - The iPhone home indicator
 *
 * @example Basic iPhone Frame
 * ```html
 * <lc-device>
 *   <lc-app-container layout="mobile">
 *     <lc-app-header slot="header">
 *       <lc-text level="3">My App</lc-text>
 *     </lc-app-header>
 *     <p>App content here</p>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Android Device
 * ```html
 * <lc-device device="android" width="360px" height="740px">
 *   <lc-app-container layout="mobile">
 *     <p>Android app example</p>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example iPad Frame
 * ```html
 * <lc-device device="ipad" width="768px" height="1024px">
 *   <lc-app-container layout="tablet">
 *     <p>iPad app example</p>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Without Notch/Controls
 * ```html
 * <lc-device
 *   device="iphone"
 *   showNotch={false}
 *   showControls={false}
 * >
 *   <lc-app-container layout="mobile">
 *     <p>Clean frame without iPhone UI elements</p>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Scaled for Demo
 * ```html
 * <lc-device scale="0.8">
 *   <lc-app-container layout="mobile">
 *     <p>80% scale for fitting in smaller spaces</p>
 *   </lc-app-container>
 * </lc-device>
 * ```
 *
 * @example Full Example with Drawer
 * ```html
 * <lc-device device="iphone" height="800px">
 *   <lc-app-container layout="mobile">
 *     <lc-app-header slot="header">
 *       <button slot="start" onclick="document.querySelector('#myDrawer').toggleDrawer()">
 *         <lc-icon name="menu"></lc-icon>
 *       </button>
 *       <lc-text level="3">My App</lc-text>
 *     </lc-app-header>
 *
 *     <lc-drawer id="myDrawer" position="left">
 *       <nav style="padding: var(--spacing-lg);">
 *         <lc-text level="4">Navigation</lc-text>
 *         <lc-link href="/">Home</lc-link>
 *         <lc-link href="/about">About</lc-link>
 *       </nav>
 *     </lc-drawer>
 *
 *     <div style="padding: var(--spacing-lg);">
 *       <p>Main content area</p>
 *     </div>
 *   </lc-app-container>
 * </lc-device>
 * ```
 */
