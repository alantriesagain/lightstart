import Dexie from "https://esm.sh/dexie@4.0.11";
import { html } from "@bootstrapp/light/html";
import { toasts } from "@bootstrapp/light/components/feedback/toasts.js";
import T from "@bootstrapp/light/types";
import View from "@bootstrapp/light";

/** @import { Prop, LabeledOption, IdbRecord, DexieTableLike, DexieIndexSpec, IdbSchema, IdbSchemaTable, IdbSchemaIndex } from "./types.ts" */
/** @import { DexieCollection } from "https://esm.sh/dexie@4.0.11" */

/**
 * Message of a thrown value, whatever it is.
 * @param {unknown} error
 * @returns {string}
 */
const errorMessage = (error) => (error instanceof Error ? error.message : String(error));

View.define("example-indexeddb-explorer", {
  props: {
    selectedDatabase: "",
    selectedStore: "",

    activeTab: 0,
    searchQuery: "",

    databases: /** @type {Prop<LabeledOption[]>} */ (T.array({ defaultValue: [] })),
    stores: /** @type {Prop<LabeledOption[]>} */ (T.array({ defaultValue: [] })),
    records: /** @type {Prop<IdbRecord[]>} */ (T.array({ defaultValue: [] })),
    selectedRecords: /** @type {Prop<IdbRecord[]>} */ (T.array({ defaultValue: [] })),
    schema: /** @type {Prop<IdbSchema | null>} */ (T.object({ defaultValue: null })),

    queryIndex: "",
    queryOperator: "equals",
    queryValue: "",
    queryResults: /** @type {Prop<IdbRecord[]>} */ (T.array({ defaultValue: [] })),

    showRecordModal: false,
    showDeleteModal: false,
    showSchemaModal: false,
    editingRecord: /** @type {Prop<IdbRecord | null>} */ (T.object({ defaultValue: null })),

    newDbName: "",
    newStoreName: "",
    newStoreKeyPath: "id",
    newIndexName: "",
    newIndexKeyPath: "",
  },

  style: true,

  async connected() {
    await this.loadDatabases();
  },

  async loadDatabases() {
    try {
      const dbs = await Dexie.getDatabaseNames();
      this.databases = dbs.map(/** @param {string} name */ (name) => ({ label: name, value: name }));

      if (this.databases.length > 0 && !this.selectedDatabase) {
        this.selectedDatabase = this.databases[0].value;
        await this.loadStores();
      }
    } catch (error) {
      console.error("Failed to load databases:", error);
      this.showToast("Failed to load databases", "error");
    }
  },

  async loadStores() {
    if (!this.selectedDatabase) {
      this.stores = [];
      this.selectedStore = "";
      return;
    }

    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      this.stores = db.tables.map(/** @param {DexieTableLike} table */ (table) => ({
        label: table.name,
        value: table.name,
      }));

      this.schema = {
        version: db.verno,
        tables: db.tables.map(/** @param {DexieTableLike} table */ (table) => ({
          name: table.name,
          keyPath: table.schema.primKey.keyPath,
          autoIncrement: table.schema.primKey.auto,
          indexes: table.schema.indexes.map(/** @param {DexieIndexSpec} idx */ (idx) => ({
            name: idx.name,
            keyPath: idx.keyPath,
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          })),
        })),
      };

      db.close();

      if (this.stores.length > 0 && !this.selectedStore) {
        this.selectedStore = this.stores[0].value;
        await this.loadRecords();
      }
    } catch (error) {
      console.error("Failed to load stores:", error);
      this.showToast("Failed to load object stores", "error");
      this.stores = [];
    }
  },

  async loadRecords() {
    if (!this.selectedDatabase || !this.selectedStore) {
      this.records = [];
      return;
    }

    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      const allRecords = await table.toArray();

      this.records = allRecords;
      this.selectedRecords = [];

      db.close();
    } catch (error) {
      console.error("Failed to load records:", error);
      this.showToast("Failed to load records", "error");
      this.records = [];
    }
  },

  /** @param {IdbRecord} record */
  async addRecord(record) {
    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      await table.add(record);

      db.close();

      await this.loadRecords();
      this.showToast("Record added successfully", "success");
    } catch (error) {
      console.error("Failed to add record:", error);
      this.showToast(`Failed to add record: ${errorMessage(error)}`, "error");
    }
  },

  /**
   * @param {IDBValidKey} key
   * @param {IdbRecord} updates
   */
  async updateRecord(key, updates) {
    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      await table.update(key, updates);

      db.close();

      await this.loadRecords();
      this.showToast("Record updated successfully", "success");
    } catch (error) {
      console.error("Failed to update record:", error);
      this.showToast(`Failed to update record: ${errorMessage(error)}`, "error");
    }
  },

  /** @param {IDBValidKey[]} keys */
  async deleteRecords(keys) {
    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      await table.bulkDelete(keys);

      db.close();

      await this.loadRecords();
      this.showToast(`Deleted ${keys.length} record(s)`, "success");
    } catch (error) {
      console.error("Failed to delete records:", error);
      this.showToast(`Failed to delete records: ${errorMessage(error)}`, "error");
    }
  },

  /** @param {string} name */
  async createDatabase(name) {
    try {
      const db = new Dexie(name);
      db.version(1).stores({});
      await db.open();
      db.close();

      await this.loadDatabases();
      this.selectedDatabase = name;
      this.showToast(`Database "${name}" created successfully`, "success");
    } catch (error) {
      console.error("Failed to create database:", error);
      this.showToast(`Failed to create database: ${errorMessage(error)}`, "error");
    }
  },

  /** @param {string} name */
  async deleteDatabase(name) {
    try {
      await Dexie.delete(name);
      await this.loadDatabases();

      if (this.selectedDatabase === name) {
        this.selectedDatabase = "";
        this.stores = [];
        this.selectedStore = "";
        this.records = [];
      }

      this.showToast(`Database "${name}" deleted successfully`, "success");
    } catch (error) {
      console.error("Failed to delete database:", error);
      this.showToast(`Failed to delete database: ${errorMessage(error)}`, "error");
    }
  },

  /**
   * @param {string} storeName
   * @param {string} keyPath
   * @param {boolean} [autoIncrement]
   */
  async createObjectStore(storeName, keyPath, autoIncrement = false) {
    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();
      const currentVersion = db.verno;
      db.close();

      const newDb = new Dexie(this.selectedDatabase);
      /** @type {Record<string, string | null>} */
      const stores = {};

      /** @type {IdbSchema} */ (this.schema).tables.forEach(/** @param {IdbSchemaTable} table */ (table) => {
        const indexes = table.indexes.map(/** @param {IdbSchemaIndex} idx */ (idx) => idx.name).join(",");
        stores[table.name] = indexes || null;
      });

      const keyPathStr = autoIncrement ? `++${keyPath}` : keyPath;
      stores[storeName] = keyPathStr;

      newDb.version(currentVersion + 1).stores(stores);
      await newDb.open();
      newDb.close();

      await this.loadStores();
      this.selectedStore = storeName;
      this.showToast(
        `Object store "${storeName}" created successfully`,
        "success",
      );
    } catch (error) {
      console.error("Failed to create object store:", error);
      this.showToast(
        `Failed to create object store: ${errorMessage(error)}`,
        "error",
      );
    }
  },

  async executeQuery() {
    if (!this.queryIndex || !this.queryValue) return void this.showToast("Please select an index and enter a value", "warning");

    try {
      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      /** @type {DexieCollection} */
      let query;

      switch (this.queryOperator) {
        case "equals":
          query = table.where(this.queryIndex).equals(this.queryValue);
          break;
        case "above":
          query = table.where(this.queryIndex).above(this.queryValue);
          break;
        case "below":
          query = table.where(this.queryIndex).below(this.queryValue);
          break;
        case "between": {
          const [start, end] = this.queryValue.split(",").map((v) => v.trim());
          query = table.where(this.queryIndex).between(start, end);
          break;
        }
        case "startsWith":
          query = table.where(this.queryIndex).startsWith(this.queryValue);
          break;
        default:
          query = table.where(this.queryIndex).equals(this.queryValue);
      }

      const results = await query.toArray();
      this.queryResults = results;

      db.close();

      this.showToast(`Found ${results.length} record(s)`, "success");
    } catch (error) {
      console.error("Query failed:", error);
      this.showToast(`Query failed: ${errorMessage(error)}`, "error");
      this.queryResults = [];
    }
  },

  async exportToJSON() {
    try {
      const data = {
        database: this.selectedDatabase,
        store: this.selectedStore,
        records: this.records,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      this.downloadFile(
        blob,
        `${this.selectedDatabase}-${this.selectedStore}.json`,
      );

      this.showToast("Exported to JSON successfully", "success");
    } catch (error) {
      console.error("Export failed:", error);
      this.showToast(`Export failed: ${errorMessage(error)}`, "error");
    }
  },

  async exportToCSV() {
    try {
      if (this.records.length === 0) return void this.showToast("No records to export", "warning");

      const keys = [...new Set(this.records.flatMap(Object.keys))];

      const csv = [
        keys.join(","),
        ...this.records.map((record) =>
          keys
            .map((key) => {
              const value = record[key];
              const stringValue =
                typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value ?? "");

              return stringValue.includes(",") || stringValue.includes('"')
                ? `"${stringValue.replace(/"/g, '""')}"`
                : stringValue;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      this.downloadFile(
        blob,
        `${this.selectedDatabase}-${this.selectedStore}.csv`,
      );

      this.showToast("Exported to CSV successfully", "success");
    } catch (error) {
      console.error("Export failed:", error);
      this.showToast(`Export failed: ${errorMessage(error)}`, "error");
    }
  },

  /** @param {File} file */
  async importFromJSON(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const records = data && typeof data === "object" && "records" in data ? data.records : undefined;

      if (!Array.isArray(records) || !records.every((record) => record !== null && typeof record === "object"))
        throw new Error("Invalid JSON format");

      const db = new Dexie(this.selectedDatabase);
      await db.open();

      const table = db.table(this.selectedStore);
      await table.bulkAdd(/** @type {Record<string, unknown>[]} */ (records));

      db.close();

      await this.loadRecords();
      this.showToast(`Imported ${records.length} record(s)`, "success");
    } catch (error) {
      console.error("Import failed:", error);
      this.showToast(`Import failed: ${errorMessage(error)}`, "error");
    }
  },

  /**
   * @param {Blob} blob
   * @param {string} filename
   */
  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** @param {string} dbName */
  async _handleDatabaseSelect(dbName) {
    this.selectedDatabase = dbName;
    this.selectedStore = "";
    await this.loadStores();
  },

  /** @param {string} storeName */
  async _handleStoreSelect(storeName) {
    this.selectedStore = storeName;
    await this.loadRecords();
  },

  /** @param {CustomEvent<number>} e */
  _handleTabChange(e) {
    this.activeTab = e.detail;
  },

  _handleAddRecord() {
    this.editingRecord = null;
    this.showRecordModal = true;
  },

  /** @param {IdbRecord} record */
  _handleEditRecord(record) {
    this.editingRecord = record;
    this.showRecordModal = true;
  },

  _handleDeleteRecords() {
    if (this.selectedRecords.length === 0) return void this.showToast("No records selected", "warning");
    this.showDeleteModal = true;
  },

  async _confirmDelete() {
    const keyPath = /** @type {IdbSchema} */ (this.schema).tables.find(
      /** @param {IdbSchemaTable} t */
      (t) => t.name === this.selectedStore,
    )?.keyPath;
    const keys = this.selectedRecords.map((record) => /** @type {IDBValidKey} */ (record[/** @type {string} */ (keyPath)]));
    await this.deleteRecords(keys);
    this.showDeleteModal = false;
  },

  /** @param {IdbRecord} record */
  async _handleSaveRecord(record) {
    if (this.editingRecord) {
      const keyPath = /** @type {IdbSchema} */ (this.schema).tables.find(
        /** @param {IdbSchemaTable} t */
        (t) => t.name === this.selectedStore,
      )?.keyPath;
      const key = /** @type {IDBValidKey} */ (this.editingRecord[/** @type {string} */ (keyPath)]);
      await this.updateRecord(key, record);
    } else
      await this.addRecord(record);

    this.showRecordModal = false;
  },

  /** @param {CustomEvent<{ selectedRows?: IdbRecord[] }>} e */
  _handleRecordSelection(e) {
    this.selectedRecords = e.detail.selectedRows || [];
  },

  async _handleRefresh() {
    await this.loadDatabases();
    if (this.selectedDatabase) {
      await this.loadStores();
      if (this.selectedStore)
        await this.loadRecords();

    }
    this.showToast("Refreshed successfully", "success");
  },

  /** @param {Event} e */
  _handleFileImport(e) {
    const file = /** @type {FileList} */ (/** @type {HTMLInputElement} */ (e.target).files)[0];
    if (file)
      this.importFromJSON(file);

  },

  renderSidebar() {
    if (this.databases.length === 0)
      return html`
        <div class="sidebar-empty">
          <lc-text variant="muted">No databases found</lc-text>
          <lc-button size="sm" @click=${this._handleRefresh}>
            Refresh
          </lc-button>
        </div>
      `;

    return html`
      <div class="sidebar-container">
        <lc-accordion>
          ${this.databases.map(/** @param {LabeledOption} db */ (db) => {
            const isSelected = this.selectedDatabase === db.value;
            const dbStores = isSelected ? this.stores : [];

            return html`
              <lc-nav-item
                ?open=${isSelected}
                icon="database"
                label=${db.label}
                badge=${isSelected ? dbStores.length : ""}
                header
                @nav-item-click=${() => this._handleDatabaseSelect(db.value)}
              ></lc-nav-item>
              ${
                isSelected
                  ? html`
                <lc-menu>
                  ${dbStores.map(
                    /** @param {LabeledOption} store */
                    (store) => html`
                    <lc-nav-item
                      label=${store.label}
                      size="sm"
                      ?active=${this.selectedStore === store.value}
                      ?activeBg=${this.selectedStore === store.value}
                      @nav-item-click=${() => this._handleStoreSelect(store.value)}
                    ></lc-nav-item>
                  `,
                  )}
                </lc-menu>
              `
                  : ""
              }
            `;
          })}
        </lc-accordion>
      </div>
    `;
  },

  renderToolbar() {
    return html`
      <lc-flex gap="sm" align="center" justify="space-between" class="toolbar">
        <lc-flex direction="column" gap="xs">
          <h2 style="margin: 0">
            ${this.selectedDatabase || "IndexedDB Explorer"}
          </h2>
          ${
            this.selectedStore
              ? html`
            <lc-text variant="muted" style="font-size: 0.875rem">
              ${this.selectedStore}
            </lc-text>
          `
              : ""
          }
        </lc-flex>

        <lc-button
          variant="secondary"
          @click=${this._handleRefresh}
          title="Refresh"
        >
          <lc-icon name="refresh-cw"></lc-icon>
        </lc-button>
      </lc-flex>
    `;
  },

  renderBrowseTab() {
    if (!this.selectedStore)
      return html`
        <lc-flex direction="column" align="center" justify="center" style="padding: 2rem">
          <lc-text variant="muted">Select a database and object store to browse records</lc-text>
        </lc-flex>
      `;

    return html`
      <lc-flex direction="column" gap="md">
        <lc-flex gap="sm">
          <lc-button variant="primary" @click=${this._handleAddRecord}>
            <lc-icon name="plus"></lc-icon> Add Record
          </lc-button>
          <lc-button
            variant="danger"
            @click=${this._handleDeleteRecords}
            ?disabled=${this.selectedRecords.length === 0}
          >
            <lc-icon name="trash"></lc-icon> Delete (${this.selectedRecords.length})
          </lc-button>
        </lc-flex>

        <lc-data-table
          searchable
          sortable
          paginated
          selectable
          .data=${this.records}
          @selection-change=${this._handleRecordSelection}
        >
          <table>
            <thead>
              <tr>
                ${
                  this.records.length > 0
                    ? Object.keys(this.records[0]).map(
                        (key) => html`<th>${key}</th>`,
                      )
                    : html`<th>No data</th>`
                }
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.records.map(
                (record) => html`
                <tr>
                  ${Object.values(record).map(
                    (value) => html`
                    <td>${typeof value === "object" ? JSON.stringify(value) : value}</td>
                  `,
                  )}
                  <td>
                    <lc-button
                      size="sm"
                      variant="secondary"
                      @click=${() => this._handleEditRecord(record)}
                    >
                      Edit
                    </lc-button>
                  </td>
                </tr>
              `,
              )}
            </tbody>
          </table>
        </lc-data-table>
      </lc-flex>
    `;
  },

  renderSchemaTab() {
    if (!this.schema)
      return html`
        <lc-flex direction="column" align="center" justify="center" style="padding: 2rem">
          <lc-text variant="muted">Select a database to view schema</lc-text>
        </lc-flex>
      `;

    return html`
      <lc-flex direction="column" gap="md">
        <lc-card>
          <h3 slot="header">Database: ${this.selectedDatabase}</h3>
          <lc-flex direction="column" gap="sm">
            <lc-text><strong>Version:</strong> ${this.schema.version}</lc-text>
            <lc-text><strong>Object Stores:</strong> ${this.schema.tables.length}</lc-text>

            <lc-flex gap="sm" style="margin-top: 1rem">
              <lc-button variant="primary" @click=${() => (this.showSchemaModal = true)}>
                Add Object Store
              </lc-button>
              <lc-button variant="danger" @click=${() => this.deleteDatabase(this.selectedDatabase)}>
                Delete Database
              </lc-button>
            </lc-flex>
          </lc-flex>
        </lc-card>

        ${this.schema.tables.map(
          /** @param {IdbSchemaTable} table */
          (table) => html`
          <lc-card>
            <h4 slot="header">${table.name}</h4>
            <lc-flex direction="column" gap="sm">
              <lc-text><strong>Key Path:</strong> ${table.keyPath}</lc-text>
              <lc-text><strong>Auto Increment:</strong> ${table.autoIncrement ? "Yes" : "No"}</lc-text>

              ${
                table.indexes.length > 0
                  ? html`
                <div>
                  <strong>Indexes:</strong>
                  <lc-list>
                    ${table.indexes.map(
                      /** @param {IdbSchemaIndex} idx */
                      (idx) => html`
                      <lc-list-item>
                        ${idx.name} (${idx.keyPath})
                        ${idx.unique ? html`<lc-badge>unique</lc-badge>` : ""}
                        ${idx.multiEntry ? html`<lc-badge>multi-entry</lc-badge>` : ""}
                      </lc-list-item>
                    `,
                    )}
                  </lc-list>
                </div>
              `
                  : html`<lc-text variant="muted">No indexes</lc-text>`
              }
            </lc-flex>
          </lc-card>
        `,
        )}
      </lc-flex>
    `;
  },

  renderQueryTab() {
    if (!this.selectedStore || !this.schema)
      return html`
        <lc-flex direction="column" align="center" justify="center" style="padding: 2rem">
          <lc-text variant="muted">Select an object store to query</lc-text>
        </lc-flex>
      `;

    const currentTable = this.schema.tables.find(
      /** @param {IdbSchemaTable} t */
      (t) => t.name === this.selectedStore,
    );
    const indexes = currentTable?.indexes || [];
    const indexOptions = [
      { label: currentTable?.keyPath, value: currentTable?.keyPath },
      ...indexes.map(/** @param {IdbSchemaIndex} idx */ (idx) => ({ label: idx.name, value: idx.name })),
    ];

    return html`
      <lc-flex direction="column" gap="md">
        <lc-card>
          <h3 slot="header">Query Builder</h3>
          <lc-flex direction="column" gap="md">
            <lc-select
              label="Index"
              .value=${this.queryIndex}
              .options=${indexOptions}
              @change=${(e) => (this.queryIndex = e.target.value)}
              placeholder="Select index..."
            ></lc-select>

            <lc-select
              label="Operator"
              .value=${this.queryOperator}
              .options=${[
                { label: "Equals", value: "equals" },
                { label: "Above", value: "above" },
                { label: "Below", value: "below" },
                { label: "Between", value: "between" },
                { label: "Starts With", value: "startsWith" },
              ]}
              @change=${(e) => (this.queryOperator = e.target.value)}
            ></lc-select>

            <lc-input
              label="Value"
              .value=${this.queryValue}
              @input=${(e) => (this.queryValue = e.target.value)}
              placeholder=${this.queryOperator === "between" ? "value1, value2" : "Enter value..."}
            ></lc-input>

            <lc-button variant="primary" @click=${this.executeQuery}>
              Execute Query
            </lc-button>
          </lc-flex>
        </lc-card>

        ${
          this.queryResults.length > 0
            ? html`
          <lc-card>
            <h3 slot="header">Results (${this.queryResults.length})</h3>
            <lc-data-table searchable sortable paginated .data=${this.queryResults}>
              <table>
                <thead>
                  <tr>
                    ${Object.keys(this.queryResults[0]).map((key) => html`<th>${key}</th>`)}
                  </tr>
                </thead>
                <tbody>
                  ${this.queryResults.map(
                    (record) => html`
                    <tr>
                      ${Object.values(record).map(
                        (value) => html`
                        <td>${typeof value === "object" ? JSON.stringify(value) : value}</td>
                      `,
                      )}
                    </tr>
                  `,
                  )}
                </tbody>
              </table>
            </lc-data-table>
          </lc-card>
        `
            : ""
        }
      </lc-flex>
    `;
  },

  renderImportExportTab() {
    if (!this.selectedStore)
      return html`
        <lc-flex direction="column" align="center" justify="center" style="padding: 2rem">
          <lc-text variant="muted">Select an object store to import/export</lc-text>
        </lc-flex>
      `;

    return html`
      <lc-flex direction="column" gap="md">
        <lc-card>
          <h3 slot="header">Export</h3>
          <lc-flex gap="sm">
            <lc-button variant="primary" @click=${this.exportToJSON}>
              <lc-icon name="download"></lc-icon> Export to JSON
            </lc-button>
            <lc-button variant="primary" @click=${this.exportToCSV}>
              <lc-icon name="download"></lc-icon> Export to CSV
            </lc-button>
          </lc-flex>
        </lc-card>

        <lc-card>
          <h3 slot="header">Import</h3>
          <lc-flex direction="column" gap="sm">
            <lc-text variant="muted">Import records from JSON file</lc-text>
            <input
              type="file"
              accept=".json"
              @change=${this._handleFileImport}
              style="padding: 0.5rem"
            />
          </lc-flex>
        </lc-card>
      </lc-flex>
    `;
  },

  renderRecordModal() {
    if (!this.showRecordModal) return "";

    const isEditing = !!this.editingRecord;
    const record = this.editingRecord || {};

    const currentTable = this.schema?.tables.find(
      /** @param {IdbSchemaTable} t */
      (t) => t.name === this.selectedStore,
    );
    const keyPath = currentTable?.keyPath;

    return html`
      <lc-modal ?open=${this.showRecordModal} @close=${() => (this.showRecordModal = false)}>
        <h3 slot="header">${isEditing ? "Edit" : "Add"} Record</h3>
        <form @submit=${(e) => {
          e.preventDefault();
          const form = e.target;
          if (!(form instanceof HTMLFormElement)) return;
          /** @type {Record<string, unknown>} */
          const record = Object.fromEntries(new FormData(form).entries());

          for (const [key, value] of Object.entries(record)) {
            if (typeof value !== "string") continue;
            try {
              record[key] = JSON.parse(value);
            } catch {

            }
          }

          this._handleSaveRecord(record);
        }}>
          <lc-flex direction="column" gap="md">
            ${
              Object.keys(record).length > 0
                ? Object.entries(record).map(
                    ([key, value]) => html`
                <lc-input
                  label=${key}
                  name=${key}
                  .value=${typeof value === "object" ? JSON.stringify(value) : String(value)}
                  ?disabled=${isEditing && key === keyPath}
                ></lc-input>
              `,
                  )
                : html`
                <lc-input label=${keyPath} name=${keyPath} required></lc-input>
                <lc-text variant="muted">Add more fields by editing the record JSON or add them after creation</lc-text>
              `
            }

            <lc-flex gap="sm" justify="flex-end">
              <lc-button type="button" variant="secondary" @click=${() => (this.showRecordModal = false)}>
                Cancel
              </lc-button>
              <lc-button type="submit" variant="primary">
                ${isEditing ? "Update" : "Add"}
              </lc-button>
            </lc-flex>
          </lc-flex>
        </form>
      </lc-modal>
    `;
  },

  renderDeleteModal() {
    if (!this.showDeleteModal) return "";

    return html`
      <lc-alert-dialog
        ?open=${this.showDeleteModal}
        @close=${() => (this.showDeleteModal = false)}
        @confirm=${this._confirmDelete}
        title="Confirm Delete"
        variant="danger"
      >
        Are you sure you want to delete ${this.selectedRecords.length} record(s)? This action cannot be undone.
      </lc-alert-dialog>
    `;
  },

  renderSchemaModal() {
    if (!this.showSchemaModal) return "";

    return html`
      <lc-modal ?open=${this.showSchemaModal} @close=${() => (this.showSchemaModal = false)}>
        <h3 slot="header">Create Object Store</h3>
        <form @submit=${async (e) => {
          e.preventDefault();
          await this.createObjectStore(
            this.newStoreName,
            this.newStoreKeyPath,
            /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="autoIncrement"]'))?.checked,
          );
          this.showSchemaModal = false;
          this.newStoreName = "";
          this.newStoreKeyPath = "id";
        }}>
          <lc-flex direction="column" gap="md">
            <lc-input
              label="Store Name"
              name="storeName"
              .value=${this.newStoreName}
              @input=${(e) => (this.newStoreName = e.target.value)}
              required
            ></lc-input>

            <lc-input
              label="Key Path"
              name="keyPath"
              .value=${this.newStoreKeyPath}
              @input=${(e) => (this.newStoreKeyPath = e.target.value)}
              required
            ></lc-input>

            <lc-checkbox name="autoIncrement">Auto Increment</lc-checkbox>

            <lc-flex gap="sm" justify="flex-end">
              <lc-button type="button" variant="secondary" @click=${() => (this.showSchemaModal = false)}>
                Cancel
              </lc-button>
              <lc-button type="submit" variant="primary">
                Create
              </lc-button>
            </lc-flex>
          </lc-flex>
        </form>
      </lc-modal>
    `;
  },

  render() {
    const tabs = [
      { label: "Browse", render: () => this.renderBrowseTab() },
      { label: "Schema", render: () => this.renderSchemaTab() },
      { label: "Query", render: () => this.renderQueryTab() },
      { label: "Import/Export", render: () => this.renderImportExportTab() },
    ];

    return html`
      <div class="example-indexeddb-explorer">
        <lc-split-pane initialSize="280px" minSize="280px">
          <div slot="primary" class="explorer-sidebar">
            ${this.renderSidebar()}
          </div>

          <div slot="secondary" class="explorer-main">
            <lc-card>
              ${this.renderToolbar()}

              <lc-tabs .activeTab=${this.activeTab} @tab-change=${this._handleTabChange}>
                ${tabs.map((tab) => html`<button slot="tab">${tab.label}</button>`)}

                <div slot="panel" class="tab-content">
                  ${tabs[this.activeTab].render()}
                </div>
              </lc-tabs>
            </lc-card>
          </div>
        </lc-split-pane>

        ${this.renderRecordModal()}
        ${this.renderDeleteModal()}
        ${this.renderSchemaModal()}
      </div>
    `;
  },

  /**
   * @param {string} message
   * @param {string} [variant]
   */
  showToast(message, variant = "info") {
    toasts.show({ message, variant });
  },
});

/**
 * IndexedDB Explorer Component
 *
 * A comprehensive IndexedDB browser and management tool built with the View framework.
 * Provides full CRUD operations, schema management, querying, and import/export capabilities.
 *
 * @component
 * @category utility
 * @tag example-indexeddb-explorer
 *
 * @fires toast - Emitted when showing notifications { message, variant }
 *
 * @example Basic Usage
 * ```html
 * <example-indexeddb-explorer></example-indexeddb-explorer>
 * ```
 *
 * @example With Event Handling
 * ```html
 * <example-indexeddb-explorer
 *   @toast=${(e) => showNotification(e.detail.message, e.detail.variant)}
 * ></example-indexeddb-explorer>
 * ```
 */
