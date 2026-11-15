/**
 * @file `light test` for a native project, or with `--all`: each test/*.test.ts under node and
 * natively, the outputs equal, `// node-only` under node alone. Files after `--`, or light test's
 * positional files, select tests by name; a file that names a workspace member selects that
 * member instead. Anywhere else light's own run is unchanged.
 */
import { basename, resolve } from "node:path";
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import { findProject } from "../../src/project.js";
import { findRoot, members } from "../../src/workspace.js";
import { run, runProject } from "../../src/commands/test.js";

/**
 * The project `dir` is in, or null.
 * @param {string} dir
 * @returns {import("../../src/project.js").Project | null}
 */
const projectAt = (dir: string) => {
  try {
    return findProject(dir);
  } catch {
    return null;
  }
};

export default defineExtension("test", {
  args: {
    all: { flag: true, description: "Test every workspace member, not only the project" },
    "node-only": { flag: true, description: "Run under node alone, skipping the native build" },
    jobs: { description: "Tests at a time (default: $JOBS or 4)" },
  },
  setup(ctx, args, api) {
    const project = projectAt(ctx.projectDir);
    /** @type {string | null} */
    let workspaceRoot = null;
    try {
      workspaceRoot = findRoot(ctx.projectDir);
    } catch {
      workspaceRoot = null;
    }
    const files = args.files ?? [];
    /** @param {string} file */
    const memberNamed = (file: string) => {
      if (workspaceRoot === null) return false;
      const absolute = resolve(ctx.cwd, file);
      return members(workspaceRoot).some((m) => m.name === file || m.dir === absolute || basename(m.dir) === file);
    };
    const names = files.filter(memberNamed);
    const tests = files.filter((file) => !memberNamed(file));
    const all = args.all;
    if (!all && project === null && names.length === 0) return;
    const flags: string[] = [];
    if (args["node-only"]) flags.push("--node-only");
    if (args.jobs !== undefined) flags.push("--jobs", args.jobs);
    api.run(async () => {
      if (!all && project !== null && names.length === 0) return (await runProject(project, flags, tests)) === 0;
      const root = workspaceRoot ?? findRoot(ctx.projectDir);
      const forwarded = [...names, ...flags, ...(tests.length > 0 ? ["--", ...tests] : [])];
      return (await run(forwarded, root)) === 0;
    });
  },
});
