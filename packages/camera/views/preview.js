import { html } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";
import T from "@lightstart/light/types";

/** @import { Prop } from "../types.ts" */

/**
 * Low-level reusable live-camera surface. Give it a MediaStream via `.stream` and
 * it renders the feed. Owns no camera logic: the parent owns the CameraInstance and
 * passes its stream, so this primitive stays reusable across apps.
 */
export default defineComponent({
  tag: "camera-preview",
  style: true,
  props: {
    stream: /** @type {Prop<MediaStream | null>} */ (T.object({ attribute: false, defaultValue: null })),
    mirror: false,
    fit: T.string({ defaultValue: "cover", enum: ["cover", "contain"] }),
    filter: "none",
  },
  firstUpdated() { this._attach(); },
  /** @param {{ changedProps: Map<string, unknown> }} args */
  updated({ changedProps }) { if (changedProps.has("stream")) this._attach(); },
  disconnected() {
    const v = this._video();
    if (v) v.srcObject = null;
  },
  _video() {
    return /** @type {HTMLVideoElement | null} */ (this.querySelector("video.cam-preview-video"));
  },
  _attach() {
    const v = this._video();
    if (!v) return;
    if (v.srcObject !== this.stream) v.srcObject = this.stream || null;
    if (this.stream) v.play?.().catch(() => {});
  },
  render() {
    return html`
      <video
        class="cam-preview-video"
        autoplay
        muted
        playsinline
        style="object-fit:${this.fit};transform:${this.mirror ? "scaleX(-1)" : "none"};filter:${this.filter || "none"}"
      ></video>
    `;
  },
});
