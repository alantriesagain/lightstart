/**
 * @file `<moderation-queue-photo>`: a profile photo as it was sent, drawn at
 * the sizes a person meets it.
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import type { QueueItem } from "../types.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

const SIZES = [
  { px: 320, key: "moderation-queue-photo.asSent", fallback: "As sent", round: false },
  { px: 96, key: "moderation-queue-photo.story", fallback: "On a story", round: true },
  { px: 40, key: "moderation-queue-photo.row", fallback: "In a row", round: true },
];

export default defineComponent({
  tag: "moderation-queue-photo",
  props: {
    item: T.object({ attribute: false, defaultValue: null }),
  },

  render() {
    const item = this.item as unknown as QueueItem | null;
    const payload = (item?.record.payload ?? {}) as { image?: unknown, from?: unknown };
    const image = typeof payload.image === "string" ? payload.image : "";
    if (image === "") return html`<p class="queue-dim">${word("moderation-queue-photo.missing", "The photo is not in the row.")}</p>`;
    return html`
      <div class="queue-photo" data-queue-photo>
        ${SIZES.map((size) => html`
          <figure>
            <img src=${image} alt=${word(size.key, size.fallback)} width=${size.px} height=${size.px} class=${size.round ? "is-round" : ""} />
            <figcaption>${word(size.key, size.fallback)}</figcaption>
          </figure>
        `)}
      </div>
      ${typeof payload.from === "string" && payload.from !== ""
        ? html`<p class="queue-dim">${word("moderation-queue-photo.from", "Handed over at the first sign-in.")}</p>`
        : ""}
    `;
  },
});
