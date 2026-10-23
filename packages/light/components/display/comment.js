import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
import { timeAgo } from "../utils/time-ago.js";
/** @import { CommentActions, Prop } from "../types.ts" */

const EXTERNAL = /^[a-z][a-z\d+.-]*:/i;

/**
 * @param {string} iso
 * @param {string} locale
 * @returns {string}
 */
const fullDate = (iso, locale) => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  try {
    return at.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return at.toISOString();
  }
};

export default defineComponent({
  tag: "lc-comment",
  style: true,
  props: {
    author: "",
    avatar: "",
    at: "",
    body: "",
    concealed: false,
    href: "",
    actions: /** @type {Prop<CommentActions | null>} */ (T.function({ defaultValue: null })),
  },
  render() {
    const locale = document.documentElement.lang || "en";
    const when = timeAgo(this.at, locale);
    return html`
      <lc-avatar class="comment-avatar" part="lc-comment-avatar" size="sm" src=${this.avatar} name=${this.author}></lc-avatar>
      <div class="comment-main" part="lc-comment-main">
        <div class="comment-header" part="lc-comment-header">
          ${this.href
            ? html`<lc-link
                class="comment-author"
                part="lc-comment-author"
                href=${this.href}
                label=${this.author}
                ?external=${EXTERNAL.test(this.href)}
              ></lc-link>`
            : html`<span class="comment-author" part="lc-comment-author">${this.author}</span>`}
          ${when
            ? html`<time class="comment-time" part="lc-comment-time" datetime=${this.at} title=${fullDate(this.at, locale)}>${when}</time>`
            : ""}
          ${this.concealed
            ? html`<lc-badge class="comment-hidden" part="lc-comment-hidden" size="xs">${lcText("lc-comment", "hidden")}</lc-badge>`
            : ""}
        </div>
        ${this.body ? html`<p class="comment-body" part="lc-comment-body">${this.body}</p>` : ""}
        ${this.actions ? html`<div class="comment-actions" part="lc-comment-actions">${this.actions()}</div>` : ""}
      </div>
    `;
  },
});

/**
 * Comment Component
 *
 * @component
 * @category display
 * @tag lc-comment
 *
 * One comment in a thread: the author's avatar and name, how long ago it was
 * written, the text, and an optional row of actions. `href` links the name
 * (an absolute URL opens in a new tab). `at` is an ISO timestamp drawn as a
 * relative time in the page's language, with the full date as its title.
 * `concealed` marks a comment the owner has hidden from the public: it draws
 * muted with a "Hidden" badge. The name avoids the HTML `hidden` attribute,
 * which would remove the element from the page.
 * `actions` is a function returning a template, drawn under the text.
 *
 * @example Basic
 * ```html
 * <lc-comment author="Ana Souza" at="2026-09-25T10:00:00Z" body="Love this spot!"></lc-comment>
 * ```
 *
 * @example With actions
 * ```js
 * html`<lc-comment
 *   author="Ana Souza"
 *   href="https://www.instagram.com/ana"
 *   .at=${comment.timestamp}
 *   .body=${comment.text}
 *   ?concealed=${comment.hidden}
 *   .actions=${() => html`<lc-button size="sm" ghost @click=${reply}>Reply</lc-button>`}
 * ></lc-comment>`
 * ```
 */
