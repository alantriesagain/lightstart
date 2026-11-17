/**
 * @file The web host's part of the generation: `.light/main.ts`, which starts
 * the manifest with `@lightstart/app/web`. The root view is the page's tag,
 * so the manifest carries no class for it.
 */

import type { HostGeneration } from "../node/generate.ts";

const generation: HostGeneration = {
  rootView: false,
  async write(_project, _dir, main, helpers) {
    const source = ['import { start } from "@lightstart/app/web";', 'import manifest from "./app.ts";', "", "await start(manifest);", ""].join("\n");
    return { changed: helpers.writeWhenChanged(main, source), classes: null, modes: [] };
  },
};

export default generation;
