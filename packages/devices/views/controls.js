import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

/** @import { Prop, DeviceControl } from "../types.ts" */

/**
 * The settings a device says it has, as rows of choices.
 *
 * A pure presenter: it neither knows nor asks where the list came from, so the
 * same rows render for a rack camera or the phone. Chrome-free like the rest of
 * this package's views: the palette belongs to whichever app renders it.
 */
export default defineComponent({
  tag: "devices-controls",
  class: "block",
  events: {
    change: T.object({ id: T.string(), value: T.any() }),
  },
  props: {
    controls: /** @type {Prop<DeviceControl[]>} */ (T.array({ defaultValue: [] })),
    only: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    compact: false,
    locked: false,
  },
  _rows() {
    if (!this.only.length) return this.controls;
    return /** @type {DeviceControl[]} */ (this.only.map((id) => this.controls.find((control) => control.id === id)).filter(Boolean));
  },
  /** @param {string} id @param {number | string} value */
  _set(id, value) {
    this.$emit("change", { id, value });
  },
  render() {
    const rows = this._rows();
    if (!rows.length) return html``;
    const locked = this.locked;
    return html`
      <lc-flex direction="column" gap=${this.compact ? "sm" : "md"}>
        ${rows.map(
          (control) => html`
          <lc-flex direction="column" gap="xs" data-control=${control.id}>
            ${this.compact ? "" : html`<lc-label text=${control.label}></lc-label>`}
            <div class="flex flex-wrap gap-1.5">
              ${control.options.map(
                (option) => html`
                <button
                  class="rounded-full px-3 py-1.5 text-xs font-semibold"
                  data-option=${option.value}
                  ?disabled=${locked}
                  aria-pressed=${String(option.value === control.value)}
                  style=${option.value === control.value
                    ? "background:var(--color-ink,#131711);color:var(--color-on-ink,#ffffff)"
                    : "background:var(--color-surface-lighter,#e9e6dd);color:var(--text-color,#131711)"}
                  @click=${() => this._set(control.id, option.value)}
                >${option.label}</button>`,
              )}
            </div>
          </lc-flex>`,
        )}
      </lc-flex>`;
  },
});
