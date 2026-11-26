import { defineRule } from "@lightstart/light/check/define.js";

const SERVER_SPECS = ["@lightstart/server", "@lightstart/sqlite"];

/** @param {string} spec */
const isServerOnly = (spec) => spec.startsWith("node:") || SERVER_SPECS.some((name) => spec === name || spec.startsWith(`${name}/`));

/** @param {string} file */
const isAppModule = (file) => /^src\/app\.(js|ts)$/.test(file);

/** The app's server code, which the page never imports: its endpoints, its `src/server` setup and `src/lib/server/`. @param {string} file */
const isServerModule = (file) => /^src\/(endpoints\/|lib\/server\/|server\.(js|ts)$)/.test(file);

export default defineRule({
  severity: "error",
  description: "a web page reaches no server-only module from src/",
  why: "the page is bundled for the browser, so a node built-in or a server package under src/ either fails the build or drags a module the browser cannot run into the bundle; a web host keeps that code in a server the page calls. The app's server code (src/endpoints/, src/lib/server/ and src/server.js) is the server's and may import them",
  check(ctx) {
    /** @type {string | null} */
    let host = null;
    for (const file of ctx.files()) {
      if (!isAppModule(file)) continue;
      const match = (ctx.code(file) ?? "").match(/\bhost\s*:\s*["']([^"']+)["']/);
      if (match) host = match[1];
    }
    if (host !== "web") return;
    for (const file of ctx.files()) {
      if (!/^src\/.*\.(js|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file) || isServerModule(file)) continue;
      for (const { spec, offset } of ctx.imports(file))
        if (isServerOnly(spec))
          ctx.report({ file, offset, message: `imports "${spec}" from the page; a web host keeps node built-ins and server packages out of src/` });
    }
  },
});
