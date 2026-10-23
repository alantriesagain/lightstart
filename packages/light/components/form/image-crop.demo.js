import { html } from "@bootstrapp/light/html";

const sample = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const sky = context.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, "#fa5c5c");
  sky.addColorStop(1, "#fec288");
  context.fillStyle = sky;
  context.fillRect(0, 0, 1200, 520);
  context.fillStyle = "#fbef76";
  context.beginPath();
  context.arc(760, 470, 120, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#3b6c8f";
  context.fillRect(0, 520, 1200, 280);
  return canvas.toDataURL("image/png");
};

/** @param {Event} e */
const use = async (e) => {
  const crop = /** @type {HTMLElement & { toBlob(): Promise<Blob | null> }} */ (/** @type {HTMLElement} */ (e.currentTarget).parentElement?.querySelector("lc-image-crop"));
  const blob = await crop?.toBlob();
  console.log(blob ? `${blob.type}, ${blob.size} bytes` : "nothing to use");
};

export default {
  description: "Pick a photo and choose the square of it to keep: drag it, pinch or scroll to zoom, or use the arrow keys, with a circle showing what a round avatar keeps. toBlob() answers a small square image.",
  preview: () => html`<div style="width:280px"><lc-image-crop src=${sample()}></lc-image-crop></div>`,
  examples: [
    {
      title: "Waiting for a photo: tap to choose one, or drop one on it",
      render: () => html`<div style="width:280px"><lc-image-crop></lc-image-crop></div>`,
    },
    {
      title: "A square frame, zoomable to eight times",
      render: () => html`<div style="width:280px"><lc-image-crop shape="square" maxZoom="8" src=${sample()}></lc-image-crop></div>`,
    },
    {
      title: "Taking the square: a 512px WebP of at most 150KB",
      render: () => html`
        <div style="width:280px;display:flex;flex-direction:column;gap:12px">
          <lc-image-crop src=${sample()} hint="Drag the photo to frame your face"></lc-image-crop>
          <lc-button primary @click=${use}>Use photo</lc-button>
        </div>`,
    },
  ],
};
