/**
 * @file Image metadata from raw bytes: JPEG SOF and PNG IHDR dimensions, and
 * null for bytes that are neither.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { imageSize } from "../metadata.js";

const jpegFixture = (width: number, height: number): Uint8Array => {
  const b = new Uint8Array(2 + 4 + 9);
  b.set([0xff, 0xd8]);
  b.set([0xff, 0xe0, 0x00, 0x02], 2);
  b.set([0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff], 6);
  return b;
};

const pngFixture = (width: number, height: number): Uint8Array => {
  const b = new Uint8Array(26);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  b[16] = width >>> 24;
  b[17] = (width >> 16) & 0xff;
  b[18] = (width >> 8) & 0xff;
  b[19] = width & 0xff;
  b[20] = height >>> 24;
  b[21] = (height >> 16) & 0xff;
  b[22] = (height >> 8) & 0xff;
  b[23] = height & 0xff;
  return b;
};

eq("parses JPEG SOF dimensions", JSON.stringify(imageSize(jpegFixture(1100, 825))), JSON.stringify({ type: "jpeg", width: 1100, height: 825 }));
eq("parses PNG IHDR dimensions", JSON.stringify(imageSize(pngFixture(512, 384))), JSON.stringify({ type: "png", width: 512, height: 384 }));

ok("answers null for unrecognized bytes", imageSize(new Uint8Array([1, 2, 3, 4])) === null);
ok("answers null for empty bytes", imageSize(new Uint8Array(0)) === null);

done();
