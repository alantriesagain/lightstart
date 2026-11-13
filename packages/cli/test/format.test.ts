/**
 * @file `formatBytes` picks the unit and keeps one decimal; nothing is `0 B`.
 * Runs under node and natively; the outputs must be identical.
 */
import { formatBytes } from "../format.ts";
import { done, eq } from "@light/test/assert.ts";

eq("zero bytes", formatBytes(0), "0 B");
eq("null bytes", formatBytes(null), "0 B");
eq("under a kilobyte", formatBytes(512), "512.0 B");
eq("kilobytes", formatBytes(1536), "1.5 KB");
eq("gigabytes", formatBytes(3 * 1024 ** 3), "3.0 GB");

done();
