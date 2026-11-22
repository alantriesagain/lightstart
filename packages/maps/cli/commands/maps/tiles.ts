import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "@lightstart/cli";
import { collect } from "@lightstart/content/collect";
import { coverageTiles } from "../../../coverage.js";
import { lngLatToWorld, worldToTile } from "../../../mercator.js";

const STYLES: Record<string, string> = {
  voyager: "rastertiles/voyager",
  light: "light_all",
  dark: "dark_all",
};

const SUBS = ["a", "b", "c", "d"];

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tileUrl = (style: string, z: string, x: string, y: string, i: number, key: string) =>
  `https://${SUBS[i % 4]}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}@2x.png${key ? `?key=${encodeURIComponent(key)}` : ""}`;

const tileAt = (z: number, lat: number, lng: number) => {
  const [wx, wy] = lngLatToWorld(lng, lat);
  const [x, y] = worldToTile(wx, wy, z);
  return `${z}/${x}/${y}`;
};

/**
 * Every model the project declares `$mapIndexable` on, read from
 * `src/models/*.js|ts`: the same list that decides what reaches
 * `map_index.json`, so the tiles cover exactly the points the map can draw
 * and there is no second list to keep in step.
 */
const mappableModels = async (projectDir: string): Promise<string[]> => {
  const dir = join(projectDir, "src", "models");
  let files: string[];
  try { files = await fs.readdir(dir); }
  catch { return []; }
  const models: string[] = [];
  for (const file of files.filter((name) => (name.endsWith(".js") || name.endsWith(".ts")) && !name.endsWith(".d.ts") && !name.includes(".test.")).sort()) {
    const module = /** @type {{ default?: { name?: unknown, schema?: Record<string, unknown> } }} */ (await import(pathToFileURL(join(dir, file)).href));
    const api = module.default;
    if (!api || typeof api !== "object" || !api.schema || !api.schema["$mapIndexable"]) continue;
    models.push(typeof api.name === "string" ? api.name : file.replace(/\.[^.]+$/, ""));
  }
  return models;
};

const readCoords = async (projectDir: string, model: string) => {
  let rows: Record<string, unknown>[];
  try { rows = collect(join(projectDir, "content", model)); }
  catch { return []; }
  const points: { lat: number; lng: number }[] = [];
  for (const record of rows) {
    const lat = Number(record["lat"]);
    const lng = Number(record["lng"]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
  }
  return points;
};

export default defineCommand({
  description: "Download map tiles covering the project's content into assets/tiles",
  usage: "light maps:tiles [--style voyager|light|dark] [--bbox west,south,east,north] [--dry-run]",
  args: {
    "full-min": { description: "Lowest zoom covered across the whole bbox (default 8)" },
    "full-max": { description: "Highest zoom covered across the whole bbox (default 13)" },
    "near-max": { description: "Highest zoom covered around each point (default 16)" },
    radius: { description: "Tile radius around each point above full-max (default 2)" },
    pad: { description: "Degrees of padding around the content bbox (default 0.05)" },
    concurrency: { description: "Parallel downloads (default 4)" },
    style: { description: "Basemap style: voyager, light or dark (default voyager)" },
    out: { description: "Output dir, relative to the project (default assets/tiles)" },
    "dry-run": { flag: true, description: "Report the coverage without downloading" },
    bbox: { description: "Cover a fixed box instead of the content's points: west,south,east,north (an app whose points are its users' own data)" },
  },
  async run(ctx, args) {
    const projectDir = ctx.projectDir;
    const values: Record<string, unknown> = args;
    const num = (name: string, dflt: number) => (values[name] === undefined ? dflt : Number(values[name]));

    const FULL_MIN = num("full-min", 8);
    const FULL_MAX = num("full-max", 13);
    const NEAR_MAX = num("near-max", 16);
    const RADIUS = num("radius", 2);
    const PAD = num("pad", 0.05);
    const CONCURRENCY = num("concurrency", 4);
    const STYLE = STYLES[args.style ?? "voyager"] ?? STYLES.voyager;
    const KEY = String(ctx.env?.CARTO_API_KEY || "");
    const TILES_DIR = join(projectDir, args.out || join("assets", "tiles"));

    const fixed = typeof args.bbox === "string" ? args.bbox.split(",").map(Number) : null;
    if (fixed && (fixed.length !== 4 || fixed.some((n: number) => !Number.isFinite(n)))) {
      ctx.log.error("✗ --bbox takes west,south,east,north in degrees.");
      return 1;
    }
    const models = fixed ? [] : await mappableModels(projectDir);
    if (!fixed && !models.length) {
      ctx.log.error("✗ No model declares $mapIndexable; nothing to cover (or pass --bbox).");
      return 1;
    }

    const points = fixed ? [] : (await Promise.all(models.map((m) => readCoords(projectDir, m)))).flat();
    if (!fixed && !points.length) {
      ctx.log.error(`✗ No coordinates in content/ for ${models.join(", ")}; geocode first.`);
      return 1;
    }

    const bbox = fixed
      ? { west: fixed[0], south: fixed[1], east: fixed[2], north: fixed[3] }
      : {
        west: Math.min(...points.map((p) => p.lng)) - PAD,
        east: Math.max(...points.map((p) => p.lng)) + PAD,
        south: Math.min(...points.map((p) => p.lat)) - PAD,
        north: Math.max(...points.map((p) => p.lat)) + PAD,
      };

    const wanted = coverageTiles({
      bbox,
      points,
      fullMin: FULL_MIN,
      fullMax: FULL_MAX,
      nearMax: NEAR_MAX,
      radius: RADIUS,
    });

    const missing: string[] = [];
    for (const key of wanted) {
      try { await fs.access(join(TILES_DIR, `${key}.png`)); }
      catch { missing.push(key); }
    }

    ctx.log.log(fixed ? `a fixed box ${JSON.stringify(bbox)}` : `${points.length} points from ${models.join(", ")}, bbox ${JSON.stringify(bbox)}`);
    ctx.log.log(`${wanted.size} tiles in coverage, ${missing.length} to download`);
    if (values["dry-run"]) return 0;

    let done = 0;
    let failed = 0;
    let bytes = 0;

    const fetchTile = async (key: string, i: number) => {
      const [z, x, y] = key.split("/");
      for (let attempt = 0; attempt < 3; attempt++)
        try {
          const res = await fetch(tileUrl(STYLE, z, x, y, i + attempt, KEY));
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return Buffer.from(await res.arrayBuffer());
        } catch (e) {
          if (attempt === 2) throw e;
          await sleep(500 * (attempt + 1));
        }
      return null;
    };

    if (missing.length) {
      const first = points[0] ?? { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 };
      const probes = await Promise.all([tileAt(FULL_MIN, first.lat, first.lng), tileAt(FULL_MAX, first.lat, first.lng)].map((key, i) => fetchTile(key, i).catch(() => null)));
      if (probes[0] && probes[1] && probes[0].equals(probes[1])) {
        ctx.log.error("✗ CARTO answered two different tiles with the same image, its API key placeholder. Get a free key at https://carto.com/basemaps/apikey and set CARTO_API_KEY in the project's .env; nothing was downloaded.");
        return 1;
      }
    }

    const worker = async (queue: string[], i: number) => {
      for (;;) {
        const key = queue.shift();
        if (!key) return;
        try {
          const buf = await fetchTile(key, i);
          if (buf) {
            const path = join(TILES_DIR, `${key}.png`);
            await fs.mkdir(dirname(path), { recursive: true });
            await fs.writeFile(path, buf);
            bytes += buf.length;
          }
          done++;
          if (done % 100 === 0)
            ctx.log.log(`  ${done}/${missing.length} (${(bytes / 1e6).toFixed(1)} MB)`);
        } catch (e) {
          failed++;
          ctx.log.error(`  FAIL ${key}: ${e instanceof Error ? e.message : String(e)}`);
        }
        await sleep(100);
      }
    };

    const queue = [...missing];
    await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(queue, i)));

    /**
     * Above fullZoomMax coverage is sparse patches around points, so the
     * manifest indexes which tiles exist, as y-runs per column, built from
     * disk (upstream 404s never land): and the engine skips the holes
     * instead of requesting them.
     */
    const sparse: Record<string, Record<string, number[][]>> = {};
    for (let z = FULL_MAX + 1; z <= NEAR_MAX; z++) {
      const zDir = join(TILES_DIR, String(z));
      let cols: string[];
      try { cols = await fs.readdir(zDir); }
      catch { continue; }
      const byX: Record<string, number[][]> = {};
      for (const col of cols.sort((a, b) => Number(a) - Number(b))) {
        let files: string[];
        try { files = await fs.readdir(join(zDir, col)); }
        catch { continue; }
        const ys = files.filter((f) => f.endsWith(".png")).map((f) => Number.parseInt(f)).sort((a, b) => a - b);
        if (!ys.length) continue;
        const runs: number[][] = [];
        for (const y of ys) {
          const last = runs[runs.length - 1];
          if (last && y === last[1] + 1) last[1] = y;
          else runs.push([y, y]);
        }
        byX[col] = runs;
      }
      if (Object.keys(byX).length) sparse[z] = byX;
    }

    await fs.mkdir(TILES_DIR, { recursive: true });
    await fs.writeFile(
      join(TILES_DIR, "manifest.json"),
      `${JSON.stringify({
        bbox,
        minZoom: FULL_MIN,
        maxZoom: NEAR_MAX,
        fullZoomMax: FULL_MAX,
        tileCount: wanted.size,
        sparse,
        attribution: ATTRIBUTION,
        generatedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      "utf8",
    );

    ctx.log.log(`Done: ${done} downloaded (${(bytes / 1e6).toFixed(1)} MB), ${failed} failed, manifest written.`);
    return failed ? 1 : 0;
  },
});
