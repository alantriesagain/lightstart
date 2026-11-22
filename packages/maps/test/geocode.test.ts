// node-only
/**
 * @file Geocoding: the first result carrying finite coordinates, the query
 * list tried in order, a provider error tolerated, the centroid floor, accent
 * folding, and concurrent callers spaced by the provider's rate.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { registerProvider } from "../index.ts";
import { foldKey, geocode as rawGeocode } from "../geocode.js";

const RATE = 20;
type GeocodeOptions = NonNullable<Parameters<typeof rawGeocode>[1]>;
const geocode = (query: string | string[], options: GeocodeOptions = {}) => rawGeocode(query, { rateMs: RATE, ...options });

let calls: string[] = [];
let answers: unknown[] = [];

const provider = (name: string) => {
  registerProvider(name, {
    search: async (query: string) => {
      calls.push(query);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return (next ?? []) as unknown[];
    },
  });
  return { name };
};

const reset = () => {
  calls = [];
  answers = [];
};

const first = async () => {
  const { name } = provider("t-first");
  answers = [[{ lat: -22.9, lng: -43.1, name: "Copacabana" }]];
  eq("the first result with coordinates answers", JSON.stringify(await geocode("Copacabana", { provider: name })), JSON.stringify({ lat: -22.9, lng: -43.1, source: name }));
};

const skips = async () => {
  const { name } = provider("t-skip");
  answers = [[{ lat: NaN, lng: -43.1 }, { lat: null, lng: null }, { lat: -22.5, lng: -43.5 }]];
  eq("a result with no finite pair is skipped", JSON.stringify(await geocode("somewhere", { provider: name })), JSON.stringify({ lat: -22.5, lng: -43.5, source: name }));
};

const chain = async () => {
  const { name } = provider("t-chain");
  answers = [[], [], [{ lat: -22.9, lng: -43.2 }]];
  const result = await geocode(["Bar, Lapa, Rio de Janeiro", "Lapa, Rio de Janeiro", "Rio de Janeiro, Brazil"], { provider: name });
  eq("a broader query answers when the precise one does not", JSON.stringify(result), JSON.stringify({ lat: -22.9, lng: -43.2, source: name }));
  eq("every query in the list was tried", String(calls.length), "3");
};

const errors = async () => {
  const { name } = provider("t-error");
  const warnings: string[] = [];
  answers = [new Error("HTTP 503"), [{ lat: -23, lng: -44 }]];
  const result = await geocode(["precise", "broader"], { provider: name, onWarn: (message: string) => warnings.push(message) });
  eq("a provider error does not give up", JSON.stringify(result), JSON.stringify({ lat: -23, lng: -44, source: name }));
  eq("one warning was reported", String(warnings.length), "1");
  ok("the warning carries the provider's message", (warnings[0] ?? "").includes("HTTP 503"));
};

const centroid = async () => {
  const { name } = provider("t-centroid");
  answers = [[], []];
  const result = await geocode(["nowhere", "still nowhere"], { provider: name, centroids: { paraty: [-23.2178, -44.7131] }, fallbackKey: "Paraty" });
  eq("the centroid is the floor", JSON.stringify(result), JSON.stringify({ lat: -23.2178, lng: -44.7131, source: "centroid" }));
};

const accent = async () => {
  const { name } = provider("t-accent");
  answers = [[]];
  const result = await geocode("x", { provider: name, centroids: { buzios: [-22.7469, -41.8817] }, fallbackKey: "Búzios" });
  eq("an accent-folded key matches its centroid", JSON.stringify(result), JSON.stringify({ lat: -22.7469, lng: -41.8817, source: "centroid" }));
};

const empty = async () => {
  const { name } = provider("t-null");
  answers = [[]];
  eq("nothing resolved and no centroid answers null", String(await geocode("nowhere at all", { provider: name })), "null");
};

const serialised = async () => {
  const { name } = provider("t-rate");
  answers = [[{ lat: 1, lng: 1 }], [{ lat: 2, lng: 2 }]];
  const started = Date.now();
  const [a, b] = await Promise.all([geocode("one", { provider: name }), geocode("two", { provider: name })]);
  eq("concurrent callers run one after the other", JSON.stringify(calls), JSON.stringify(["one", "two"]));
  eq("each caller gets its own answer", JSON.stringify([a?.lat, b?.lat]), JSON.stringify([1, 2]));
  ok("the second lookup waits out the first's rate window", Date.now() - started >= RATE);
};

reset();
await first();
reset();
await skips();
reset();
await chain();
reset();
await errors();
reset();
await centroid();
reset();
await accent();
reset();
await empty();
reset();
await serialised();

eq("folding drops accents, case and space", foldKey("  Armação dos Búzios "), "armacao dos buzios");
eq("folding an empty value answers empty", foldKey(undefined), "");

done();
