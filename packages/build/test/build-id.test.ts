// node-only
/**
 * @file A build id is a moment in `YYYYMMDD-HHMMSS`, sortable and readable in a folder name.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { generateBuildId } from "../build-id.ts";

eq("a moment as YYYYMMDD-HHMMSS", generateBuildId(new Date(2026, 8, 4, 7, 5, 9)), "20260904-070509");
ok("now has the same shape", /^\d{8}-\d{6}$/.test(generateBuildId()));
done();
