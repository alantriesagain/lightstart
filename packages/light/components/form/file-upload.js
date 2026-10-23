import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { formatBytes } from "../utils/bytes.js";
import { lcText } from "../utils/text.js";
/** @import { Prop } from "../types.ts" */

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

export default defineComponent({
  tag: "lc-file-upload",
  props: {
    _internals: /** @type {Prop<ElementInternals | null>} */ (T.object({ reactive: false, defaultValue: null })),
    name: "",
    accept: "",
    multiple: false,
    disabled: false,
    required: false,
    maxSize: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
    showPreview: true,
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "dropzone"],
    }),
    value: /** @type {Prop<string | File | Array<string | File> | null>} */ (T.any({ attribute: false, defaultValue: null })),
    dragOver: false,
    error: "",
    _objectUrls: /** @type {Prop<Map<File, string>>} */ (T.object({ reactive: false, defaultValue: () => new Map() })),
  },
  style: true,
  formAssociated: true,

  connected() {
    if (!this._internals)
      this._internals = this.attachInternals();
    this.$own(() => this._revokeAll());
  },

  /**
   * The value as the list it is, whatever shape it was handed in.
   * @returns {Array<string | File>}
   */
  get entries() {
    if (this.value == null) return [];
    return Array.isArray(this.value) ? this.value : [this.value];
  },

  /**
   * Only the Files, for a caller that has to upload something.
   * @returns {File[]}
   */
  get files() {
    return /** @type {File[]} */ (this.entries.filter((entry) => entry instanceof File));
  },

  /**
   * One object URL per File, made once and revoked when the File goes. A URL
   * made in render leaks a blob per frame, and the browser holds the blob
   * alive until the document does.
   * @param {File} file
   */
  _previewUrl(file) {
    let url = this._objectUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      this._objectUrls.set(file, url);
    }
    return url;
  },

  /** @param {Array<string | File>} keeping */
  _revokeGone(keeping) {
    const kept = new Set(keeping);
    for (const [file, url] of this._objectUrls)
      if (!kept.has(file)) {
        URL.revokeObjectURL(url);
        this._objectUrls.delete(file);
      }
  },

  _revokeAll() {
    for (const url of this._objectUrls.values()) URL.revokeObjectURL(url);
    this._objectUrls.clear();
  },

  /** @param {Array<string | File>} entries */
  _commit(entries) {
    this._revokeGone(entries);
    this.value = this.multiple ? entries : (entries[0] ?? null);
    this._internals?.setFormValue(this._formData());
    this.$emit("change", { value: this.value, files: this.files });
  },

  /** @param {Event} e */
  handleFileSelect(e) {
    const files = Array.from(/** @type {HTMLInputElement} */ (e.target).files || []);
    this._processFiles(files);
  },

  /** @param {DragEvent} e */
  handleDrop(e) {
    e.preventDefault();
    this.dragOver = false;

    if (this.disabled) return;

    const files = Array.from(/** @type {DataTransfer} */ (e.dataTransfer).files || []);
    this._processFiles(files);
  },

  /** @param {Event} e */
  handleDragOver(e) {
    e.preventDefault();
    if (!this.disabled)
      this.dragOver = true;

  },

  /** @param {Event} e */
  handleDragLeave(e) {
    e.preventDefault();
    this.dragOver = false;
  },

  /** @param {File[]} files */
  _processFiles(files) {
    this.error = "";

    if (!this.multiple && files.length > 1) {
      this.error = "Only one file is allowed";
      this.$emit("error", { error: this.error });
      return;
    }

    const maxSize = this.maxSize;
    if (maxSize) {
      const oversized = files.find((f) => f.size > maxSize);
      if (oversized) {
        this.error = `File ${oversized.name} exceeds maximum size of ${formatBytes(maxSize)}`;
        this.$emit("error", { error: this.error });
        return;
      }
    }

    this._commit(this.multiple ? [...this.entries, ...files] : files);
  },

  _formData() {
    const data = new FormData();
    for (const entry of this.entries) data.append(this.name || "files", entry);
    return data;
  },

  /** @param {number} index */
  removeFile(index) {
    this._commit(this.entries.filter((_, i) => i !== index));
  },

  /** @param {File} file */
  _isImage(file) {
    return file.type.startsWith("image/");
  },

  _describe(/** @type {string | File} */ entry) {
    if (entry instanceof File)
      return { name: entry.name, size: formatBytes(entry.size), preview: this._isImage(entry) ? this._previewUrl(entry) : null };
    const url = String(entry);
    return { name: url.split("/").pop() || url, size: "stored", preview: IMAGE_URL.test(url) ? url : null };
  },

  render() {
    if (this.variant === "dropzone")
      return this._renderDropzone();

    return this._renderDefault();
  },

  _renderDefault() {
    return html`
      <div class="file-upload">
        <label class="file-upload-label">
          <input
            type="file"
            class="file-upload-input"
            accept=${this.accept}
            ?multiple=${this.multiple}
            ?disabled=${this.disabled}
            ?required=${this.required}
            @change=${this.handleFileSelect}
          />
          <lc-button variant="secondary">
            <lc-icon name="upload"></lc-icon>
            Choose ${this.multiple ? "Files" : "File"}
          </lc-button>
        </label>

        ${this.error ? html`<div class="file-upload-error">${this.error}</div>` : ""}
        ${this.showPreview && this.entries.length > 0 ? this._renderFileList() : ""}
      </div>
    `;
  },

  _renderDropzone() {
    return html`
      <div
        class="file-dropzone ${this.dragOver ? "dragover" : ""} ${this.disabled ? "disabled" : ""}"
        @drop=${this.handleDrop}
        @dragover=${this.handleDragOver}
        @dragleave=${this.handleDragLeave}
      >
        <label class="file-dropzone-label">
          <input
            type="file"
            class="file-upload-input"
            accept=${this.accept}
            ?multiple=${this.multiple}
            ?disabled=${this.disabled}
            ?required=${this.required}
            @change=${this.handleFileSelect}
          />
          <div class="file-dropzone-content">
            <lc-icon name="cloud-upload" size="xl"></lc-icon>
            <p class="file-dropzone-text">
              <strong>${lcText("lc-file-upload", "click")}</strong> ${lcText("lc-file-upload", "drag")}
            </p>
            ${this.accept ? html`<p class="file-dropzone-hint">${this.accept}</p>` : ""}
            ${this.maxSize ? html`<p class="file-dropzone-hint">Max size: ${formatBytes(this.maxSize)}</p>` : ""}
          </div>
        </label>

        ${this.error ? html`<div class="file-upload-error">${this.error}</div>` : ""}
        ${this.showPreview && this.entries.length > 0 ? this._renderFileList() : ""}
      </div>
    `;
  },

  _renderFileList() {
    return html`
      <div class="file-list">
        ${this.entries.map((entry, index) => {
          const { name, size, preview } = this._describe(entry);
          return html`
            <div class="file-item">
              ${
                preview && this.showPreview
                  ? html`<img class="file-preview" src=${preview} alt=${name} />`
                  : html`<lc-icon name="file" class="file-icon"></lc-icon>`
              }
              <div class="file-info">
                <div class="file-name">${name}</div>
                <div class="file-size">${size}</div>
              </div>
              <button
                type="button"
                class="file-remove"
                @click=${() => this.removeFile(index)}
                ?disabled=${this.disabled}
              >
                <lc-icon name="x"></lc-icon>
              </button>
            </div>
          `;
        })}
      </div>
    `;
  },
});

/**
 * File Upload Component
 *
 * @component
 * @category form
 * @tag lc-file-upload
 *
 * File upload input with drag-and-drop support and preview.
 *
 * @example
 * // Basic file upload
 * ```html
 * <lc-file-upload></lc-file-upload>
 * ```
 *
 * @example
 * // Multiple files
 * ```html
 * <lc-file-upload multiple></lc-file-upload>
 * ```
 *
 * @example
 * // Dropzone variant
 * ```html
 * <lc-file-upload variant="dropzone"></lc-file-upload>
 * ```
 *
 * @example
 * // Accept only images
 * ```html
 * <lc-file-upload accept="image/*" variant="dropzone"></lc-file-upload>
 * ```
 *
 * @example
 * // With file size limit (5MB)
 * ```html
 * <lc-file-upload max-size="5242880" variant="dropzone"></lc-file-upload>
 * ```
 *
 * @example
 * // Multiple images with preview
 * ```html
 * <lc-file-upload
 *   accept="image/*"
 *   multiple
 *   variant="dropzone"
 *   show-preview
 * ></lc-file-upload>
 * ```
 *
 * @example
 * // Documents only
 * ```html
 * <lc-file-upload
 *   accept=".pdf,.doc,.docx"
 *   variant="dropzone"
 * ></lc-file-upload>
 * ```
 *
 * @example
 * // With event handling
 * ```js
 * html`<lc-file-upload
 *   @change=${(e) => this.handleFiles(e.detail.files)}
 *   @error=${(e) => this.showError(e.detail.error)}
 *   variant="dropzone"
 * ></lc-file-upload>`
 * ```
 *
 * @example
 * // In a form
 * ```html
 * <form>
 *   <label>Upload your resume:</label>
 *   <lc-file-upload
 *     name="resume"
 *     accept=".pdf,.doc,.docx"
 *     required
 *     max-size="2097152"
 *   ></lc-file-upload>
 *   <button type="submit">Submit Application</button>
 * </form>
 * ```
 */
