import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  tag: "lc-draggable",
  style: true,
  props: {
    "dragged-id": T.string(),
    handle: "",
    target: T.string(),
    onDragged: T.function(),
    _lastDownTarget: /** @type {Prop<EventTarget | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  connected() {
    this.setAttribute("draggable", "true");

    const onDragStart = /** @type {EventListener} */ ((e) => this.handleDragStart(/** @type {DragEvent} */ (e)));
    const onDragEnd = /** @type {EventListener} */ ((e) => this.handleDragEnd(/** @type {DragEvent} */ (e)));
    this.addEventListener("dragstart", onDragStart);
    this.addEventListener("dragend", onDragEnd);
    this.$own(() => {
      this.removeEventListener("dragstart", onDragStart);
      this.removeEventListener("dragend", onDragEnd);
    });

    if (this.handle) {
      const onMouseDown = /** @type {EventListener} */ ((e) => { this._lastDownTarget = e.target; });
      this.addEventListener("mousedown", onMouseDown, true);
      this.$own(() => this.removeEventListener("mousedown", onMouseDown, true));
    }
  },
  /**
   * @this {HTMLElement & { handle: string, _lastDownTarget?: EventTarget | null, "dragged-id": string }}
   * @param {DragEvent} event
   */
  handleDragStart(event) {
    if (this.handle) {
      const handleEl = this.querySelector(this.handle);
      if (!handleEl || !this._lastDownTarget || !handleEl.contains(/** @type {Node | null} */ (this._lastDownTarget))) return void event.preventDefault();
    }
    event.stopPropagation();
    this.classList.add("dragging");
    /** @type {DataTransfer} */ (event.dataTransfer).setData("text/plain", this["dragged-id"] || "");
    /** @type {DataTransfer} */ (event.dataTransfer).effectAllowed = "move";
  },
  /**
   * @this {HTMLElement & { _lastDownTarget?: EventTarget | null }}
   * @param {DragEvent} _event
   */
  handleDragEnd(_event) {
    this.classList.remove("dragging");
    this._lastDownTarget = null;
  },
});
