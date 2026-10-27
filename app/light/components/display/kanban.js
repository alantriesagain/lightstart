import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { lcText } from "../utils/text.js";

/** @import { KanbanAdd, KanbanColumn, KanbanColumnRenderer, KanbanDropTarget, KanbanMove, KanbanRow, KanbanRowRenderer, KanbanSelect, Prop } from "../types.js" */

export default defineComponent({
  tag: "lc-kanban",
  style: true,
  props: {
    rows: /** @type {Prop<KanbanRow[]>} */ (T.array({ defaultValue: [] })),
    columns: /** @type {Prop<KanbanColumn[]>} */ (T.array({ defaultValue: [] })),
    groupByField: "section",
    addable: false,
    nestable: false,
    addPlaceholder: "",
    onMove: /** @type {Prop<KanbanMove | null>} */ (T.function()),
    onAdd: /** @type {Prop<KanbanAdd | null>} */ (T.function()),
    onSelect: /** @type {Prop<KanbanSelect | null>} */ (T.function()),
    renderItem: /** @type {Prop<KanbanRowRenderer | null>} */ (T.function()),
    renderColumnActions: /** @type {Prop<KanbanColumnRenderer | null>} */ (T.function()),
    newTitles: /** @type {Prop<Record<string, string>>} */ (T.object({ defaultValue: {} })),
    dropTarget: /** @type {Prop<KanbanDropTarget | null>} */ (T.object({ defaultValue: null })),
  },

  /** @returns {KanbanColumn[]} */
  _resolvedColumns() {
    if (this.columns.length) return this.columns;
    /** @type {Set<string>} */
    const seen = new Set();
    for (const r of this.rows || []) {
      const v = r?.[this.groupByField];
      if (v != null) seen.add(String(v));
    }
    return [...seen].map((name) => ({ name }));
  },

  /** @param {string} name */
  _rowsForColumn(name) {
    return (this.rows || []).filter(
      (r) => String(r[this.groupByField] ?? "") === name,
    );
  },

  /**
   * @param {DragEvent} e
   * @param {string} columnName
   */
  _handleColumnDrop(e, columnName) {
    if (e.defaultPrevented) return;
    const draggedId = e.dataTransfer?.getData("text/plain");
    if (!draggedId) return;
    this.dropTarget = null;
    this.onMove?.(draggedId, columnName, { beforeId: null, afterId: null, nestUnderId: null });
  },

  /**
   * @param {DragEvent} e
   * @param {string | number} rowId
   * @param {string} columnName
   */
  _handleCardDragOver(e, rowId, columnName) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const rect = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    /** @type {KanbanDropTarget["zone"]} */
    let zone;
    if (this.nestable && ratio >= 0.33 && ratio <= 0.67) zone = "on";
    else if (ratio < 0.5) zone = "above";
    else zone = "below";
    const key = String(rowId);
    if (this.dropTarget?.cardId !== key
      || this.dropTarget?.zone !== zone
      || this.dropTarget?.column !== columnName)
      this.dropTarget = { cardId: key, zone, column: columnName };
  },

  /**
   * @param {DragEvent} e
   * @param {string | number} rowId
   */
  _handleCardDragLeave(e, rowId) {
    if (e.relatedTarget && /** @type {HTMLElement} */ (e.currentTarget).contains(/** @type {Node} */ (e.relatedTarget))) return;
    if (this.dropTarget?.cardId === String(rowId)) this.dropTarget = null;
  },

  /**
   * @param {DragEvent} e
   * @param {string | number} rowId
   * @param {string} columnName
   */
  _handleCardDrop(e, rowId, columnName) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer?.getData("text/plain");
    const zone = this.dropTarget?.zone || "below";
    this.dropTarget = null;
    if (!draggedId) return;
    if (String(rowId) === draggedId && zone !== "on") return;
    this.onMove?.(draggedId, columnName, {
      beforeId: zone === "above" ? rowId : null,
      afterId: zone === "below" ? rowId : null,
      nestUnderId: zone === "on" ? rowId : null,
    });
  },

  /** @param {string} columnName */
  _submitAdd(columnName) {
    const title = (this.newTitles[columnName] || "").trim();
    if (!title) return;
    this.onAdd?.(columnName, title);
    this.newTitles = { ...this.newTitles, [columnName]: "" };
  },

  /** @param {KanbanRow} row */
  _defaultCard(row) {
    const label = row.title || row.name || `#${row.id}`;
    return html`
      <lc-card class="lc-kanban-card" hover @click=${() => this.onSelect?.(row)}>
        <span>${label}</span>
      </lc-card>
    `;
  },

  /**
   * @param {string | number} rowId
   * @param {string} columnName
   */
  _cardWrapperClass(rowId, columnName) {
    const dt = this.dropTarget;
    if (!dt || dt.cardId !== String(rowId) || dt.column !== columnName) return "lc-kanban-card-wrapper";
    return `lc-kanban-card-wrapper drop-${dt.zone}`;
  },

  render() {
    const cols = this._resolvedColumns();
    return html`
      <div class="lc-kanban">
        ${cols.map((col) => {
          const rows = this._rowsForColumn(col.name);
          return html`
            <div
              class="lc-kanban-column"
              style=${col.color ? `--column-accent: ${col.color}` : ""}
            >
              <div class="lc-kanban-header">
                ${col.icon ? html`<lc-icon name=${col.icon} size="14"></lc-icon>` : ""}
                <span>${col.label || col.name}</span>
                <span class="lc-kanban-count">${rows.length}</span>
                ${this.renderColumnActions ? html`<span class="lc-kanban-actions">${this.renderColumnActions(col)}</span>` : ""}
              </div>
              <lc-droparea
                droparea-id=${col.name}
                class="lc-kanban-body"
                .ondrop=${(/** @type {DragEvent} */ e) => this._handleColumnDrop(e, col.name)}
              >
                ${rows.map(
                  (row) => html`
                    <lc-draggable
                      dragged-id=${row.id}
                      class=${this._cardWrapperClass(row.id, col.name)}
                      @dragover=${(/** @type {DragEvent} */ e) => this._handleCardDragOver(e, row.id, col.name)}
                      @dragleave=${(/** @type {DragEvent} */ e) => this._handleCardDragLeave(e, row.id)}
                      @drop=${(/** @type {DragEvent} */ e) => this._handleCardDrop(e, row.id, col.name)}
                    >
                      ${this.renderItem ? this.renderItem(row) : this._defaultCard(row)}
                    </lc-draggable>
                  `,
                )}
              </lc-droparea>
              ${this.addable
                ? html`
                    <div class="lc-kanban-footer">
                      <lc-icon name="plus" size="12"></lc-icon>
                      <input
                        type="text"
                        placeholder=${this.addPlaceholder || lcText("lc-kanban", "addPlaceholder")}
                        .value=${this.newTitles[col.name] || ""}
                        @input=${(e) => {
                          this.newTitles = { ...this.newTitles, [col.name]: e.target.value };
                        }}
                        @keydown=${(e) => { if (e.key === "Enter") this._submitAdd(col.name); }}
                      />
                    </div>
                  `
                : ""}
            </div>
          `;
        })}
      </div>
    `;
  },
});
