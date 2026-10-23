import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getFileStorage, setFileStorage, uploadFiles } from "./file-storage.ts";

const schema = { title: { fieldType: "string" }, attachment: { fieldType: "file" }, gallery: { fieldType: "files" } };

afterEach(() => setFileStorage(null));

test("without a file storage the row keeps its blobs", async () => {
  const row = { title: "t", attachment: new Blob(["x"]) };
  assert.equal(await uploadFiles(schema, "docs", row), row);
  assert.equal(getFileStorage(), null);
});

test("a registered file storage receives every file field, data urls included, and answers urls", async () => {
  const uploads = [];
  setFileStorage({ upload: async (blob, opts) => { uploads.push({ size: blob.size, type: blob.type, ...opts }); return { url: `/u/${opts.field}/${uploads.length}` }; } });
  const dataUrl = `data:text/plain;base64,${btoa("hey")}`;
  const out = await uploadFiles(schema, "docs", { title: "t", attachment: new Blob(["ab"]), gallery: [dataUrl, "/kept.png"] });
  assert.deepEqual(out, { title: "t", attachment: "/u/attachment/1", gallery: ["/u/gallery/2", "/kept.png"] });
  assert.deepEqual(uploads, [
    { size: 2, type: "", field: "attachment", model: "docs" },
    { size: 3, type: "text/plain", field: "gallery", model: "docs" },
  ]);
});
