/**
 * Build the catalogue as a static site a plain file host can serve.
 *
 * The SPA build bundles every component, but the docs site is also a showcase:
 * its rail and catalogue read the manifest's component map, and each component
 * page imports the component's own source and `.demo.js` to draw its examples.
 * The production manifest drops those maps and ships no package files, so on a
 * static host the rail is empty, `/components` says "Nothing matches", and a
 * component page cannot resolve its demo.
 *
 * This script runs the normal SPA build (`--bundle-all`) against a dev server,
 * puts the component maps back into the built manifest, and mirrors the package
 * modules the showcase imports (`/app/**`) into the deploy as plain, type-
 * stripped JavaScript with their bare specifiers already resolved.
 *
 *   node website/scripts/static-export.mjs
 */
import { spawn } from "node:child_process";
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const website = join(dirname(fileURLToPath(import.meta.url)), "..");
const builds = join(website, ".deployed", "builds");
const port = Number(process.env.EXPORT_PORT || 3621);
const origin = `http://127.0.0.1:${port}`;

const log = (message) => console.log(`▸ ${message}`);
const SPECIFIER = /\b(?:from|import)\s*(?:\(\s*)?(["'])([^"']+)\1/g;
const CSS_URL = /@import\s+(["'])([^"']+)\1|url\(\s*(["']?)([^)"']+)\3\s*\)/g;

/** @param {string} dir */
const newestBuild = async (dir) => {
  const entries = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && /^\d{8}-\d{6}$/.test(e.name));
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries.length ? join(dir, entries.at(-1).name) : null;
};

/** @param {string} file */
const exists = (file) => stat(file).then(() => true, () => false);

const before = await newestBuild(builds);
log(`dev server on ${origin}`);
const server = spawn("pnpm", ["exec", "bootstrapp", "serve", "--port", String(port)], {
  cwd: website,
  detached: true,
  stdio: ["ignore", "ignore", "inherit"],
});

let manifest = null;
try {
  for (let i = 0; i < 240; i++) {
    try {
      const response = await fetch(`${origin}/.bootstrapp.json`);
      if (response.ok) { manifest = await response.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!manifest) throw new Error("dev server did not answer");
  log(`dev manifest: ${Object.keys(manifest.importmap ?? {}).length} importmap entries`);

  log("building (spa, bundle-all)");
  const build = spawn("pnpm", ["exec", "bootstrapp", "build", "--spa", "--bundle-all", "--port", String(port)], {
    cwd: website,
    stdio: "inherit",
  });
  const code = await new Promise((r) => build.on("close", r));
  if (code !== 0) throw new Error(`build exited ${code}`);

  const built = await newestBuild(builds);
  if (!built || built === before) throw new Error("no new build appeared");
  log(`build ${built.slice(builds.length + 1)}`);

  await restoreComponentMaps(built, manifest);
  const count = await mirrorModules(built, manifest);
  log(`mirrored ${count} package modules`);
  if (!(await exists(join(built, "schemas.js")))) await writeFile(join(built, "schemas.js"), "export default {};\n");
  log(`ready: ${built}`);
} finally {
  try { process.kill(-server.pid, "SIGKILL"); } catch {}
}

/**
 * Merge the dev manifest's package component maps into the shipped manifest and
 * into the manifest inlined at the top of `frontend.js`.
 * @param {string} buildDir
 * @param {any} dev
 */
async function restoreComponentMaps(buildDir, dev) {
  const prodPath = join(buildDir, ".bootstrapp.json");
  const prod = JSON.parse(await readFile(prodPath, "utf8"));
  /** @type {Record<string, unknown>} */
  const maps = {};
  for (const [name, record] of Object.entries(dev.packages ?? {})) {
    if (!prod.packages?.[name] || !(/** @type {any} */ (record))?.components) continue;
    maps[name] = /** @type {any} */ (record).components;
    prod.packages[name].components = /** @type {any} */ (record).components;
  }
  await writeFile(prodPath, `${JSON.stringify(prod)}\n`);

  const frontendPath = join(buildDir, "frontend.js");
  const code = await readFile(frontendPath, "utf8");
  const marker = "window.__BOOTSTRAPP_MANIFEST__=";
  const at = code.indexOf(marker);
  if (at === -1) throw new Error("no inlined manifest in frontend.js");
  const start = code.indexOf("{", at + marker.length);
  let depth = 0;
  let quote = "";
  let end = -1;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { end = i; break; }
  }
  if (end === -1) throw new Error("unterminated inlined manifest");
  const patch = `;for(const[k,v]of Object.entries(${JSON.stringify(maps)})){const p=window.__BOOTSTRAPP_MANIFEST__.packages[k]||(window.__BOOTSTRAPP_MANIFEST__.packages[k]={});p.components=v;}`;
  await writeFile(frontendPath, code.slice(0, end + 1) + patch + code.slice(end + 1));
  log(`restored component maps: ${Object.keys(maps).join(", ")}`);
}


/**
 * Walk the showcase's module graph from the component map, fetching each file
 * from the dev server (which strips types and resolves bare specifiers) and
 * writing it into the deploy.
 * @param {string} buildDir
 * @param {any} dev
 */
async function mirrorModules(buildDir, dev) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const queue = [];

  /** @param {string} url */
  const enqueue = (url) => {
    const pathname = new URL(url, origin).pathname;
    if (!pathname.startsWith("/app/")) return;
    if (!/\.(?:m?js|m?ts|css|json)$/.test(pathname)) return;
    if (seen.has(pathname)) return;
    seen.add(pathname);
    queue.push(pathname);
  };

  for (const [name, record] of Object.entries(dev.packages ?? {})) {
    for (const paths of Object.values(/** @type {any} */ (record).components ?? {})) {
      if (!paths || typeof paths !== "object" || Array.isArray(paths)) continue;
      for (const file of Object.values(/** @type {any} */ (paths))) {
        if (typeof file !== "string" || file.endsWith("/")) continue;
        const url = `/app/${name}/${file}`;
        enqueue(url);
        if (url.endsWith(".js")) {
          enqueue(url.replace(/\.js$/, ".demo.js"));
          enqueue(url.replace(/\.js$/, ".css"));
        }
      }
    }
  }

  let written = 0;
  while (queue.length) {
    const pathname = queue.shift();
    const response = await fetch(`${origin}${pathname}`);
    if (!response.ok) continue;
    const mime = response.headers.get("content-type") ?? "";
    const isModule = /\.(?:js|mjs|ts|mts)$/.test(pathname);
    const isCss = /\.css$/.test(pathname);
    const isJson = /\.json$/.test(pathname);
    if (!((isModule && /javascript/.test(mime)) || (isCss && /css/.test(mime)) || (isJson && /json/.test(mime)))) continue;
    let body = await response.text();
    if (isModule) {
      body = body.replace(SPECIFIER, (match, quote, specifier) => {
        const fixed = specifier.replace(/\.m?ts$/, (ext) => ext.replace("ts", "js"));
        return fixed === specifier ? match : match.replace(specifier, fixed);
      });
      for (const match of body.matchAll(SPECIFIER)) {
        const specifier = match[2].replace(/\.m?ts$/, (ext) => ext.replace("ts", "js"));
        enqueue(new URL(specifier, `${origin}${pathname}`).pathname);
      }
    } else if (/\.css$/.test(pathname)) {
      for (const match of body.matchAll(CSS_URL)) {
        const specifier = match[2] ?? match[4];
        if (specifier && !specifier.startsWith("data:") && !specifier.startsWith("http")) enqueue(new URL(specifier, `${origin}${pathname}`).pathname);
      }
    }
    const out = pathname.endsWith(".ts") ? `${pathname.slice(0, -3)}.js` : pathname;
    const file = join(buildDir, out);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    written += 1;
  }
  return written;
}
