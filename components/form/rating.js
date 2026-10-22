import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-rating",
  style: true,
  props: {
    value: 0,
    max: 5,
    change: T.function(),
  },
  render() {
    const { value, max, readonly, change } = this;

    return html`
      <div class="lc-rating__container">
        ${Array.from({ length: max }, (/** @type {unknown} */ _, index) => {
          const isFilled = index < Math.round(value);
          return html`
            <lc-icon
              name="star"
              ?solid=${isFilled}
              class=${isFilled ? "star-filled" : "star-empty"}
              @click=${() => !readonly && change && change(index + 1)}
            ></lc-icon>
          `;
        })}
      </div>
    `;
  },
});
