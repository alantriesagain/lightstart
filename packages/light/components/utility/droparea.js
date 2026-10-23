import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { DropInfo, Prop } from "../types.ts" */

export default defineComponent({
  tag: "lc-droparea",
  style: true,
  props: {
    _dropIndex: T.number({ reactive: false, defaultValue: -1 }),
    onDropped: /** @type {Prop<((info: DropInfo) => void) | null>} */ (T.function()),
    "droparea-id": T.string(),
    orderable: false,
    direction: "vertical",
  },
  connected() {
    this._dropIndex = -1;
    const onDragOver = /** @type {EventListener} */ (this.handleDragOver.bind(this));
    const onDrop = /** @type {EventListener} */ (this.handleDrop.bind(this));
    const onDragEnter = /** @type {EventListener} */ (this.handleDragEnter.bind(this));
    const onDragLeave = /** @type {EventListener} */ (this.handleDragLeave.bind(this));
    this.addEventListener("dragover", onDragOver);
    this.addEventListener("drop", onDrop);
    this.addEventListener("dragenter", onDragEnter);
    this.addEventListener("dragleave", onDragLeave);
    this.$own(() => {
      this.removeEventListener("dragover", onDragOver);
      this.removeEventListener("drop", onDrop);
      this.removeEventListener("dragenter", onDragEnter);
      this.removeEventListener("dragleave", onDragLeave);
    });
  },
  /** @param {DragEvent & { _handledByOrderable?: boolean }} event */
  handleDragOver(event) {
    event.preventDefault();
    /** @type {DataTransfer} */ (event.dataTransfer).dropEffect = "move";
    this.classList.add("over");

    if (this.orderable && !event._handledByOrderable) {
      event._handledByOrderable = true;
      this._updateDropIndex(this.direction === "horizontal" ? event.clientX : event.clientY);
    } else if (this.orderable)
      this._hideIndicator();

  },
  /** @param {DragEvent} event */
  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    this.classList.remove("over");
    this._hideIndicator();
    const draggedId = /** @type {DataTransfer} */ (event.dataTransfer).getData("text/plain");
    const targetId = this["droparea-id"];
    const info = {
      draggedId,
      targetId,
      event,
      droparea: this,
      ...(this.orderable ? { index: this._dropIndex } : {}),
    };
    if (this.onDropped) this.onDropped(info);
    this._dropIndex = -1;
  },
  /** @param {DragEvent} event */
  handleDragEnter(event) {
    event.preventDefault();
    this.classList.add("over");
  },
  /** @param {DragEvent} event */
  handleDragLeave(event) {
    if (event.relatedTarget && this.contains(/** @type {Node | null} */ (event.relatedTarget))) return;
    this.classList.remove("over");
    this._hideIndicator();
  },

  _getOrderableChildren() {
    return [...this.children].filter(
      (el) => el.tagName !== "STYLE" && !el.classList.contains("drop-indicator-line"),
    );
  },

  /** @param {number} clientPos */
  _updateDropIndex(clientPos) {
    const children = this._getOrderableChildren();
    const horizontal = this.direction === "horizontal";
    let index = children.length;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (horizontal) {
        const midX = rect.left + rect.width / 2;
        if (clientPos < midX) { index = i; break; }
      } else {
        const midY = rect.top + rect.height / 2;
        if (clientPos < midY) { index = i; break; }
      }
    }

    this._dropIndex = index;

    const areaRect = this.getBoundingClientRect();
    /** @type {number} */
    let indicatorPos;
    if (children.length === 0)
      indicatorPos = 4;
     else if (index < children.length) {
      const r = children[index].getBoundingClientRect();
      indicatorPos = horizontal ? r.left - areaRect.left : r.top - areaRect.top;
    } else {
      const lastChild = children[children.length - 1];
      const r = lastChild.getBoundingClientRect();
      indicatorPos = horizontal ? r.right - areaRect.left : r.bottom - areaRect.top;
    }

    const prop = horizontal ? "--drop-indicator-x" : "--drop-indicator-y";
    this.style.setProperty(prop, `${indicatorPos}px`);
    this.setAttribute("data-dropping", "");
  },

  _hideIndicator() {
    this.removeAttribute("data-dropping");
    this.style.removeProperty("--drop-indicator-y");
    this.style.removeProperty("--drop-indicator-x");
  },
});
