/**
 * @file `light-native typecheck --all | <member…>`: tsc over each member's own tsconfig.json, run in the member's
 * folder after its prepare steps (generated sources must exist). An error is the member's own when
 * its file is inside the member and outside node_modules; the rest is reported and does not count
 * (a dependency's problem fails that dependency's own run). A member holding sources but no
 * tsconfig fails the run: every member is checked.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { prepare } from "../prepare.js";
import { capture } from "../run.js";
import { Member, memberByName, members, tscPath } from "../workspace.js";

const SKIP = new Set(["node_modules", "dist", "out", ".scriptc", "test"]);

/**
 * Whether `dir` holds a .ts or .js source anywhere below it (tests apart).
 * @param {string} dir
 * @returns {boolean}
 */
const hasSource = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (hasSource(path)) return true;
    } else if (/\.(ts|js|mjs)$/.test(name)) return true;
  }
  return false;
};

/**
 * tsc's lines split into the member's own errors and the others'.
 * @param {string} output
 * @param {Member} member
 * @returns {{ own: string[], foreign: string[] }}
 */
export const attribute = (output, member) => {
  /** @type {string[]} */
  const own = [];
  /** @type {string[]} */
  const foreign = [];
  for (const line of output.split("\n")) {
    if (line.trim().length === 0) continue;
    const m = /^(.+?)\(\d+,\d+\): error TS\d+: /.exec(line);
    if (m === null) {
      own.push(line);
      continue;
    }
    const file = resolve(member.dir, m[1]);
    const inside = !relative(member.dir, file).startsWith("..") && !file.includes("/node_modules/");
    (inside ? own : foreign).push(line);
  }
  return { own, foreign };
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const names = args.filter((a) => a !== "--all");
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  const tsc = tscPath(root);
  let status = 0;
  for (const m of targets) {
    const label = relative(root, m.dir);
    if (!existsSync(join(m.dir, "tsconfig.json"))) {
      if (hasSource(m.dir)) {
        console.log("✗ " + label + ": sources but no tsconfig.json");
        status = 1;
      }
      continue;
    }
    await prepare(root, m);
    const r = await capture(tsc, ["-p", "tsconfig.json", "--pretty", "false"], { cwd: m.dir });
    const { own, foreign } = attribute(r.out, m);
    if (own.length > 0) {
      status = 1;
      console.log("✗ " + label + " (" + String(own.length) + " error" + (own.length === 1 ? "" : "s") + ")");
      for (const line of own) console.log("  " + line);
    } else console.log("✓ " + label + (foreign.length > 0 ? " (" + String(foreign.length) + " outside it)" : ""));
  }
  return status;
};
