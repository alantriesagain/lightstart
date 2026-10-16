/** @import { TypeOptions, TypeDefinition, TypeExtension } from "./types.ts" */

/**
 * `T.file()` extension: a string field with metadata for auto-uploading
 * File/Blob objects through the registered file storage (`setFileStorage`).
 *
 * @param {TypeOptions & {
 *   accept?: string,
 *   maxSize?: number,
 *   maxWidth?: number | null,
 *   maxHeight?: number | null,
 *   quality?: number | null,
 * }} [options]
 * @returns {TypeDefinition}
 */
const createFileType = (options = {}) =>
  /** @type {TypeDefinition} */ ({
    $type: "string",
    persist: true,
    attribute: true,
    fieldType: "file",
    accept: options.accept || "image/*",
    maxSize: options.maxSize || 5 * 1024 * 1024,
    maxWidth: options.maxWidth || null,
    maxHeight: options.maxHeight || null,
    quality: options.quality || null,
    ...options,
  });

/**
 * `T.files()`: array variant for multi-upload fields.
 *
 * @param {TypeOptions & {
 *   accept?: string,
 *   maxSize?: number,
 *   maxWidth?: number | null,
 *   maxHeight?: number | null,
 *   quality?: number | null,
 *   maxItems?: number | null,
 * }} [options]
 * @returns {TypeDefinition}
 */
const createFilesType = (options = {}) =>
  /** @type {TypeDefinition} */ ({
    $type: "array",
    persist: true,
    attribute: true,
    fieldType: "files",
    accept: options.accept || "image/*",
    maxSize: options.maxSize || 5 * 1024 * 1024,
    maxWidth: options.maxWidth || null,
    maxHeight: options.maxHeight || null,
    quality: options.quality || null,
    maxItems: options.maxItems || null,
    defaultValue: [],
    ...options,
  });

/** @type {TypeExtension} */
export default {
  types: {
    file: createFileType,
    files: createFilesType,
  },
};
