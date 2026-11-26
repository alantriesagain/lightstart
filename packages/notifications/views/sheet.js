import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { lcText } from "@lightstart/components/utils/text.js";
import words from "../locales/en.js";

/**
 * The inbox in a bottom sheet, which is where a phone reads it. A host that
 * wants it somewhere else renders `notifications-list` on its own.
 *
 * It is the modal sheet `lc-bottom-sheet` describes: nothing of it shows until
 * it is open, it takes the height of the inbox up to a cap, and the list is
 * drawn only while it is up. A host styles it through the sheet's own variables
 * on this element, `--lc-bottom-sheet-z-index` above its own bars included.
 */
export default defineComponent({
  tag: "notifications-sheet",
  style: true,
  props: {
    open: false,
  },
  events: {
    "sheet-closed": T.object({}),
  },
  _close() {
    this.open = false;
    this.$emit("sheet-closed", {});
  },
  render() {
    return html`
      <lc-bottom-sheet ?open=${this.open} @sheet-closed=${() => this._close()}>
        ${this.open
          ? html`<div slot="sheet" class="notifications-sheet-body">
              <lc-text level="3" size="lg" weight="bold">${lcText("notifications-sheet", "title", {}, words["notifications-sheet"])}</lc-text>
              <notifications-list read-all @select=${() => this._close()}></notifications-list>
            </div>`
          : ""}
      </lc-bottom-sheet>`;
  },
});
