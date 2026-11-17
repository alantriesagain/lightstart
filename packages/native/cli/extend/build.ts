/**
 * @file `light build` for a native project: when the folder is a project (the nearest
 * package.json with a native block at it), the page build gives way to one step that runs the
 * project's prepare steps and scriptc's build of `native.entry` into `dist/<binary>`, as
 * the old native build did. Anywhere else the page build is unchanged and `--strip` does nothing.
 */
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build/extension.ts";
import { buildProject } from "../../src/commands/build.js";
import { findProject } from "../../src/project.js";

/**
 * The project whose folder is exactly `dir`, or null when `dir` is not one.
 * @param {string} dir
 * @returns {import("../../src/project.js").Project | null}
 */
const projectAt = (dir: string) => {
  try {
    const project = findProject(dir);
    return project.dir === dir ? project : null;
  } catch {
    return null;
  }
};

export default defineExtension("build", {
  args: {
    strip: { flag: true, description: "Drop the native binary's symbol table" },
  },
  setup(_ctx, { strip }, api) {
    const project = projectAt(api.options.root);
    if (project === null) return;
    for (const name of api.steps.names()) api.steps.remove(name);
    api.steps.add({
      name: "native",
      async run() {
        console.log(await buildProject(project, { strip }));
      },
    });
  },
});
