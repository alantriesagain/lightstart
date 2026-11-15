/**
 * @file `light check --all | <member…>`: the conventions every member follows (src/check/rules.js), each
 * finding printed with its file and rule; the run fails on any.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMember, describe, exportsTargetsTs, ffiHeaderValid, memberLabel, noCrossMemberRelativeImport, noRootPathsInTests, testsDir, tsconfigCanonical, undeclaredDeps } from "../check/rules.js";
import { allMembers, memberByName, members } from "../workspace.js";

const template = () => readFileSync(join(import.meta.dirname, "..", "..", "templates", "tsconfig.json"), "utf8");

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const names = args.filter((a) => a !== "--all");
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  const tsconfig = template();
  const memberNames = new Set(allMembers(root).map((m) => m.name));
  let status = 0;
  for (const m of targets) {
    const findings = checkMember(m, tsconfig, memberNames);
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

/**
 * A standalone project's conventions; its dependencies are links, not workspace members, so the
 * workspace protocol is not one of them.
 * @param {import("../project.js").Project} project
 * @returns {Promise<number>}
 */
export const checkProject = async (project) => {
  const findings = [
    ...noCrossMemberRelativeImport(project),
    ...undeclaredDeps(project, new Set()),
    ...exportsTargetsTs(project),
    ...ffiHeaderValid(project),
    ...tsconfigCanonical(project, template()),
    ...noRootPathsInTests(project),
    ...testsDir(project),
  ];
  if (findings.length === 0) {
    console.log("✓ .");
    return 0;
  }
  console.log("✗ . (" + String(findings.length) + ")");
  for (const f of findings) console.log("  " + describe(f, project.dir));
  return 1;
};
