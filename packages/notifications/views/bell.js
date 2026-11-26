import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { lcText } from "@lightstart/components/utils/text.js";
import notifications from "../controllers/notifications.ts";
import words from "../locales/en.js";

/**
 * The bell, with how many lines are unread on its corner (nine, then 9+).
 * `icon` names the glyph it draws (a bell unless the app picks another, an
 * inbox say); the label stays the inbox's either way.
 *
 * It opens nothing by itself: an app decides where the inbox appears, so this
 * emits `open` and the host mounts a sheet, a drawer or a route.
 *
 * @example
 * ```html
 * <notifications-bell glass icon="inbox" @open=${() => openAlerts()}></notifications-bell>
 * ```
 */
export default defineComponent({
  tag: "notifications-bell",
  style: true,
  props: {
    unread: T.number({ defaultValue: 0, sync: notifications }),
    glass: false,
    icon: "bell",
    iconSize: "18",
  },
  events: {
    open: T.object({}),
  },
  render() {
    return html`
      <lc-button
        ?glass=${this.glass}
        iconOnly
        icon=${this.icon}
        iconSize=${this.iconSize}
        aria-label=${this.unread
          ? lcText("notifications-bell", "labelUnread", { count: this.unread }, words["notifications-bell"])
          : lcText("notifications-bell", "label", {}, words["notifications-bell"])}
        @click=${() => this.$emit("open", {})}
      ></lc-button>
      ${this.unread ? html`<lc-badge corner primary data-count aria-hidden="true">${this.unread > 9 ? "9+" : this.unread}</lc-badge>` : ""}`;
  },
});
