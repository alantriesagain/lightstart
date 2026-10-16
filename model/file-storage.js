/**
 * The file storage the store uploads `T.file()` values through. A package
 * that stores files (an asset service, a bucket) registers its provider
 * here; without one, blobs stay on the row untouched and the adapter decides
 * what to do with them.
 */

/** @import { FileStorage, ModelSchema, Row } from "./types.ts" */

/** @type {FileStorage | null} */
let storage = null;

/** @param {FileStorage | null} provider */
export const setFileStorage = (provider) => { storage = provider; };

/** @returns {FileStorage | null} */
export const getFileStorage = () => storage;

/** @param {unknown} value @returns {value is string} */
const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:");

/** @param {string} dataUrl */
const dataUrlToBlob = (dataUrl) => {
  const [header = "", base64 = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

/**
 * @param {FileStorage} provider
 * @param {unknown} item
 * @param {{ field: string, model: string }} where
 */
const uploadOne = async (provider, item, where) => {
  const blob = isDataUrl(item) ? dataUrlToBlob(item) : item;
  if (!(blob instanceof Blob)) return item;
  return (await provider.upload(blob, where)).url;
};

/**
 * Send every `T.file()` / `T.files()` value of a row through the registered
 * storage and put the answered url in its place. Without a provider the row
 * comes back untouched.
 *
 * @param {ModelSchema | undefined} schema
 * @param {string} model
 * @param {Row} row
 * @returns {Promise<Row>}
 */
export const uploadFiles = async (schema, model, row) => {
  if (!storage || !schema) return row;
  const provider = storage;
  /** @type {Row} */
  const out = { ...row };
  for (const [field, fieldDef] of Object.entries(schema)) {
    if (field.startsWith("$")) continue;
    const kind = /** @type {{ fieldType?: string }} */ (fieldDef).fieldType;
    if (kind === "file") out[field] = await uploadOne(provider, out[field], { field, model });
    else if (kind === "files" && Array.isArray(out[field]))
      out[field] = await Promise.all(/** @type {unknown[]} */ (out[field]).map((item) => uploadOne(provider, item, { field, model })));
  }
  return out;
};
