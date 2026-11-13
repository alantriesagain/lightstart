// node-only
/**
 * @file `loadEnv` sets what the file declares, strips quotes, skips comments, and never overrides
 * a set variable.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "../env.ts";
import { done, eq } from "@light/test/assert.ts";

const dir = mkdtempSync(join(tmpdir(), "cli-env-"));
const keys = ["CLI_TEST_PLAIN", "CLI_TEST_QUOTED", "CLI_TEST_SINGLE", "CLI_TEST_SET"];
for (const key of keys) delete process.env[key];
process.env.CLI_TEST_SET = "already";
writeFileSync(join(dir, ".env"), "# comment\nCLI_TEST_PLAIN=one\nCLI_TEST_QUOTED=\"two words\"\nCLI_TEST_SINGLE='three'\nCLI_TEST_SET=file\nnot-a-pair\n");

try {
  loadEnv(dir);
  eq("an unquoted value", process.env.CLI_TEST_PLAIN ?? "", "one");
  eq("a double-quoted value", process.env.CLI_TEST_QUOTED ?? "", "two words");
  eq("a single-quoted value", process.env.CLI_TEST_SINGLE ?? "", "three");
  eq("a set variable wins", process.env.CLI_TEST_SET ?? "", "already");
  loadEnv(join(dir, "missing"));
  eq("a missing folder is fine", process.env.CLI_TEST_PLAIN ?? "", "one");
} finally {
  for (const key of keys) delete process.env[key];
  rmSync(dir, { recursive: true, force: true });
}

done();
