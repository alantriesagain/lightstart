/**
 * List Item Component
 *
 * An item within lc-list, with no render of its own: the role says what
 * this is.
 */

import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-list-item",
  /** @this {HTMLElement} */
  connected() {
    this.setAttribute("role", "listitem");
  },
});
