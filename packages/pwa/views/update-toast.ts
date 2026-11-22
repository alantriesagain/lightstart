/**
 * @file `<pwa-update-toast>`: a small bar that appears while a new worker is
 * waiting, with a Reload action and a dismiss. The app writes the tag; the
 * generated components module defines it from the package's tag table.
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { pwa } from "../page.ts";

const word = (key: string, fallback: string): string => translate(`pwa-update-toast.${key}`) ?? fallback;

export default defineComponent({
  tag: "pwa-update-toast",
  style: true,
  props: {
    message: "",
    reloadLabel: "",
    dismissLabel: "",
  },
  dismissed: false,

  render() {
    if (!pwa.update.value.waiting || this.dismissed) return html``;
    return html`
      <div part="pwa-update-toast-bar" class="bar" role="status" aria-live="polite">
        <span part="pwa-update-toast-message">${this.message || word("message", "A new version is available.")}</span>
        <button part="pwa-update-toast-reload" type="button" @click=${() => void pwa.apply()}>${this.reloadLabel || word("reload", "Reload")}</button>
        <button part="pwa-update-toast-dismiss" type="button" aria-label=${this.dismissLabel || word("dismiss", "Dismiss")} @click=${() => (this.dismissed = true)}>×</button>
      </div>
    `;
  },

  updated() {
    if (!pwa.update.peek().waiting && this.dismissed) this.dismissed = false;
  },
});
