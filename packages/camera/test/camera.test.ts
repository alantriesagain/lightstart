// node-only
/**
 * @file The lens model, the control registry and the EXIF reader.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { classifyLens, describeZoom, effectiveMm } from "../lib/lens-model.js";
import { CONTROLS, controlById } from "../lib/controls.js";
import { parseExif, readExifTags } from "../lib/exif.js";

const buildExifJpeg = (focalNum: number, focalDen: number): ArrayBuffer => {
  const tiff = new ArrayBuffer(52);
  const dv = new DataView(tiff);
  const le = true;
  dv.setUint16(0, 0x4949, false);
  dv.setUint16(2, 0x002a, le);
  dv.setUint32(4, 8, le);
  dv.setUint16(8, 1, le);
  dv.setUint16(10, 0x8769, le);
  dv.setUint16(12, 4, le);
  dv.setUint32(14, 1, le);
  dv.setUint32(18, 26, le);
  dv.setUint32(22, 0, le);
  dv.setUint16(26, 1, le);
  dv.setUint16(28, 0x920a, le);
  dv.setUint16(30, 5, le);
  dv.setUint32(32, 1, le);
  dv.setUint32(36, 44, le);
  dv.setUint32(40, 0, le);
  dv.setUint32(44, focalNum, le);
  dv.setUint32(48, focalDen, le);

  const tiffBytes = new Uint8Array(tiff);
  const total = 2 + 4 + 6 + tiffBytes.length;
  const out = new Uint8Array(total);
  const ov = new DataView(out.buffer);
  ov.setUint16(0, 0xffd8, false);
  ov.setUint16(2, 0xffe1, false);
  ov.setUint16(4, 6 + tiffBytes.length + 2, false);
  out[6] = 0x45; out[7] = 0x78; out[8] = 0x69; out[9] = 0x66; out[10] = 0; out[11] = 0;
  out.set(tiffBytes, 12);
  return out.buffer;
};

eq("an ultra-wide label names an ultra-wide", classifyLens("camera2 0, facing back (ultra wide)").lensType, "ultrawide");
eq("a telephoto label names a telephoto", classifyLens("Telephoto Camera").lensType, "telephoto");
eq("a front label names the front camera", classifyLens("FaceTime HD Camera (front)").lensType, "front");
eq("an unknown label falls back to a sane default", classifyLens("").lensType, "unknown");
eq("the fallback lens is a 26mm main lens", String(classifyLens("").nominalMm), "26");

eq("effective mm multiplies the nominal length by zoom", String(effectiveMm(26, 2)), "52");
const zoom = describeZoom(26, 2);
eq("the zoom description keeps the ratio", String(zoom.zoom), "2");
eq("the zoom description computes the mm", String(zoom.mm), "52");
ok("the zoom description labels the mm", zoom.label.includes("52mm"));

eq("aperture is always simulated", String(controlById("aperture")?.simulate), "true");
eq("zoom drives the real hardware zoom key", controlById("zoom")?.hardwareKey, "zoom");
for (const control of CONTROLS) {
  ok(`control ${control.id} says what it does`, Boolean(control.explain.what));
  ok(`control ${control.id} says why it matters`, Boolean(control.explain.why));
  ok(`control ${control.id} says when to use it`, Boolean(control.explain.when));
}

ok("a non-jpeg buffer carries no EXIF", readExifTags(new Uint8Array([1, 2, 3, 4]).buffer) === null);
const exif = await parseExif(new Blob([buildExifJpeg(52, 1)], { type: "image/jpeg" }));
ok("a crafted jpeg parses", exif !== null);
eq("the crafted jpeg reports its focal length", String(exif?.focalLength), "52");

done();
