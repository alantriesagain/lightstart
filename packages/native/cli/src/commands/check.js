/**
 * @file `light-native check --all | <member…>`: the conventions every member follows (src/check/rules.js), each
 * finding printed with its file and rule; the run fails on any.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMember, describe, memberLabel } from "../check/rules.js";
import { allMembers, memberByName, members } from "../workspace.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const names = args.filter((a) => a !== "--all");
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  const template = readFileSync(join(import.meta.dirname, "..", "..", "templates", "tsconfig.json"), "utf8");
  const memberNames = new Set(allMembers(root).map((m) => m.name));
  let status = 0;
  for (const m of targets) {
    const findings = checkMember(m, template, memberNames);
    if (findings.length === 0) {
      console.log("✓ " + memberLabel(m));
      continue;
    }
    status = 1;
    console.log("✗ " + memberLabel(m) + " (" + String(findings.length) + ")");
    for (const f of findings) console.log("  " + describe(f, root));
  }
  return status;
};
