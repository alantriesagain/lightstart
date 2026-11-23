// node-only
/**
 * @file GoPro media URLs, response shaping and import summaries.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";
import type { MediaListReply } from "../types.ts";
import {
  parseMediaList,
  isVideo,
  isImportable,
  downloadUrl,
  thumbUrl,
  sinceFilter,
  totalBytes,
  formatBytes,
} from "../lib/media.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const fixture = {
  media: [
    {
      d: "100GOPRO",
      fs: [
        { n: "GX010001.MP4", s: "1048576", cre: "1770000000", dur: "12" },
        { n: "GX010002.MP4", s: "2097152", cre: "1770000600", dur: "30" },
        { n: "GX010002.THM", s: "8000", cre: "1770000600" },
      ],
    },
    {
      d: "101GOPRO",
      fs: [{ n: "GX010003.MP4", s: "4194304", cre: "1770004000", dur: "60" }],
    },
  ],
};

const items = parseMediaList(fixture);
eq("parseMediaList flattens directories into items", items.length, 4);
eq("parseMediaList keeps the path", items[0].path, "100GOPRO/GX010001.MP4");
eq("parseMediaList reads the size", items[0].sizeBytes, 1048576);
eq("parseMediaList reads the duration", items[0].durationMs, 12000);
eq("parseMediaList keeps the directory", items[3].dir, "101GOPRO");
eq("parseMediaList converts capture time to ISO", items[0].capturedAt, new Date(1770000000 * 1000).toISOString());

deep("parseMediaList survives an empty list", parseMediaList({ media: [] }), []);
deep("parseMediaList survives no media key", parseMediaList({}), []);
deep("parseMediaList survives null", parseMediaList(null), []);
deep("parseMediaList skips a directory without files", parseMediaList({ media: [{ d: "100GOPRO" }] }), []);
deep("parseMediaList skips a directory without a name", parseMediaList({ media: [{ fs: [{ n: "x.MP4" }] }] }), []);

const [bare] = parseMediaList({ media: [{ d: "100GOPRO", fs: [{ n: "GX01.MP4" }] }] });
eq("a missing size defaults to zero", bare.sizeBytes, 0);
eq("a missing duration defaults to zero", bare.durationMs, 0);
eq("a missing capture time defaults to empty", bare.capturedAt, "");

eq("isVideo covers MP4", isVideo("GX010001.MP4"), true);
eq("isVideo covers 360", isVideo("GS010001.360"), true);
eq("isVideo covers LRV", isVideo("GL010001.LRV"), true);
eq("isVideo refuses JPG", isVideo("GOPR0001.JPG"), false);
eq("isVideo refuses THM", isVideo("GX010002.THM"), false);
eq("isImportable accepts MP4", isImportable("GX010001.MP4"), true);
eq("isImportable refuses 360", isImportable("GS010001.360"), false);
eq("isImportable refuses LRV", isImportable("GL010001.LRV"), false);

eq("downloadUrl targets the camera", downloadUrl(items[0]), "http://10.5.5.9:8080/videos/DCIM/100GOPRO/GX010001.MP4");
eq("thumbUrl targets the camera", thumbUrl(items[0]), "http://10.5.5.9:8080/gopro/media/thumbnail?path=100GOPRO%2FGX010001.MP4");

const boundary = items[1].capturedAt;
const kept = sinceFilter(items, boundary);
eq("sinceFilter is inclusive at the boundary", kept.length, 3);
eq("sinceFilter keeps the boundary clip", kept[0].capturedAt, boundary);
eq("sinceFilter without a timestamp keeps everything", sinceFilter(items, "").length, 4);
eq("sinceFilter drops undated clips", sinceFilter([{ name: "x", dir: "d", path: "d/x", sizeBytes: 0, capturedAt: "", durationMs: 0 }], "2026-01-01T00:00:00.000Z").length, 0);

eq("totalBytes sums the import", totalBytes(items), 1048576 + 2097152 + 8000 + 4194304);
eq("formatBytes zero", formatBytes(0), "0 KB");
eq("formatBytes megabytes", formatBytes(1048576), "1 MB");
eq("formatBytes gigabytes", formatBytes(1024 * 1024 * 1024 * 1.5), "1.5 GB");

ok("a numeric reply reads as an empty list", parseMediaList(42 as unknown as MediaListReply).length === 0);

done();
