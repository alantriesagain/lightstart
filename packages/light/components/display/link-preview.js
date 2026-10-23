import { html, nothing } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";

/** @param {string} url */
const deriveDomain = (url) => {
  try {
    return new URL(url, location.href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** @param {string} url */
const isExternal = (url) => {
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch {
    return false;
  }
};

export default defineComponent({
  tag: "lc-link-preview",
  style: true,
  props: {
    url: "",
    title: "",
    description: "",
    image: "",
    favicon: "",
    domain: "",
  },

  render() {
    const domain = this.domain || deriveDomain(this.url);
    const external = isExternal(this.url);
    return html`
      <lc-card padding="none" hover>
        <a
          class="link-preview"
          href=${this.url}
          target=${external ? "_blank" : nothing}
          rel=${external ? "noopener noreferrer" : nothing}
        >
          ${this.image
            ? html`<img class="link-preview-thumb" src=${this.image} alt="" loading="lazy" />`
            : ""}
          <span class="link-preview-body">
            <span class="link-preview-title">${this.title}</span>
            ${this.description
              ? html`<span class="link-preview-description">${this.description}</span>`
              : ""}
            ${domain
              ? html`
                <span class="link-preview-domain">
                  ${this.favicon
                    ? html`<img class="link-preview-favicon" src=${this.favicon} alt="" loading="lazy" />`
                    : ""}
                  ${domain}
                </span>
              `
              : ""}
          </span>
        </a>
      </lc-card>
    `;
  },
});

/**
 * Link Preview Component
 *
 * @component
 * @category display
 * @tag lc-link-preview
 *
 * A generic OG/bookmark preview card: optional thumbnail, title, clamped
 * description and a favicon+domain row. The whole card links to the URL;
 * external URLs open in a new tab with rel="noopener noreferrer". The domain
 * is derived from the URL when not given.
 *
 * @example
 * // Basic preview
 * ```html
 * <lc-link-preview
 *   url="https://example.com/article"
 *   title="An Interesting Article"
 *   description="A short summary of what the linked page is about, clamped to two lines."
 * ></lc-link-preview>
 * ```
 *
 * @example
 * // With thumbnail and favicon
 * ```html
 * <lc-link-preview
 *   url="https://example.com/article"
 *   title="An Interesting Article"
 *   description="A short summary of what the linked page is about."
 *   image="https://picsum.photos/300/200"
 *   favicon="https://example.com/favicon.ico"
 * ></lc-link-preview>
 * ```
 *
 * @example
 * // Explicit domain label
 * ```html
 * <lc-link-preview
 *   url="https://news.ycombinator.com/item?id=1"
 *   title="Show HN: Something"
 *   domain="Hacker News"
 * ></lc-link-preview>
 * ```
 */
