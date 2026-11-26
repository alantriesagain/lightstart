/**
 * @file `<moderation-queue-payload>`: a submission's payload read out as
 * fields a person can judge: text as text, an image as an image, anything else
 * as its JSON, and nothing empty.
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import { payloadFields } from "../queue/lib.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

export default defineComponent({
  tag: "moderation-queue-payload",
  props: {
    payload: T.object({ attribute: false, defaultValue: {} }),
  },

  render() {
    const fields = payloadFields(this.payload);
    if (!fields.length) return html`<p class="queue-dim">${word("moderation-queue-payload.empty", "Nothing was sent with it.")}</p>`;
    return html`
      <dl class="queue-fields" data-queue-payload>
        ${fields.map((field) => html`
          <dt>${field.key}</dt>
          <dd data-field=${field.key}>
            ${field.kind === "image"
              ? html`<a href=${field.value} target="_blank" rel="noopener"><img class="queue-field-image" src=${field.value} alt=${field.key} /></a>`
              : field.kind === "json" ? html`<pre>${field.value}</pre>` : field.value}
          </dd>
        `)}
      </dl>
    `;
  },
});
