import T from "/app/light/types/types.js";
import { defineComponent, trackWork } from "/app/light/view/index.js";

/** @type {Map<string, Promise<void>>} */
const imageStyleCache = new Map();

/**
 * @param {string} url
 * @param {string} className
 * @returns {Promise<void>}
 */
const inlineBase64Style = async (url, className) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const blob = await response.blob();
  /** @type {string} */
  const base64String = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  let styleSheet = document.getElementById("lc-image-styles");
  if (!styleSheet) {
    styleSheet = document.createElement("style");
    styleSheet.id = "lc-image-styles";
    document.head.appendChild(styleSheet);
  }
  styleSheet.innerHTML += `.${className} { background-image: url(${base64String}); }`;
};

/**
 * Inline `url` as a background-image rule for `className`, once per url. A
 * failed fetch drops the url from the cache, so the next component asking for
 * it tries again rather than inheriting one transient failure for the life of
 * the page.
 *
 * @param {string} url
 * @param {string} className
 * @returns {Promise<void>}
 */
export const createBase64Style = (url, className) => {
  const inFlight = imageStyleCache.get(url);
  if (inFlight) return inFlight;
  const pending = trackWork(
    inlineBase64Style(url, className).catch((/** @type {unknown} */ error) => {
      imageStyleCache.delete(url);
      console.error("Failed to fetch and convert image:", error);
    }),
    `lc-image:${url}`,
  );
  imageStyleCache.set(url, pending);
  return pending;
};

export default defineComponent({
  tag: "lc-image",
  class: "bg-cover bg-center",
  props: {
    src: T.string(),
    alt: "",
  },
  connected() {
    this.applySrc();
  },
  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("src")) this.applySrc();
  },
  applySrc() {
    if (!this.src) return;
    const uniqueClass = `lc-img-${btoa(this.src).replace(/=/g, "")}`;
    this.classList.add(uniqueClass);
    createBase64Style(this.src, uniqueClass);
  },
});
