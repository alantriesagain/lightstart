// node-only
/**
 * @file The content adapter type over a fake fetch: list reads in memory, the
 * whole row from its own file (cached), and every write refused.
 */

import { defineApp } from "@lightstart/app";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { ContentAdapterType } from "../store.ts";

const list = [
  { id: "alpha", slug: "alpha", title: "Alpha guide", areas: ["core", "start"] },
  { id: "beta", slug: "beta", title: "Beta guide", areas: ["extra"] },
  { id: "gamma", slug: "gamma", title: "Gamma guide", areas: ["core"] },
];

const whole: Record<string, Record<string, unknown>> = {
  alpha: { id: "alpha", slug: "alpha", title: "Alpha guide", areas: ["core", "start"], setup: ["Open the panel", "Pick a mode"], cues: ["Green"], mistakes: ["Skip warm-up"], body: [] },
  beta: { id: "beta", slug: "beta", title: "Beta guide", areas: ["extra"], setup: ["Load the map"], cues: ["Bell"], mistakes: ["Rush"], body: [] },
  gamma: { id: "gamma", slug: "gamma", title: "Gamma guide", areas: ["core"], setup: ["Choose a route"], cues: ["Timer"], mistakes: ["Forget rope"], body: [] },
};

const fetched: string[] = [];

const fake: typeof fetch = async (input) => {
  const url = String(input);
  fetched.push(url);
  if (url === "/site/content/guide.json") return new Response(JSON.stringify(list), { status: 200 });
  const row = /^\/site\/content\/guide\/([^/]+)\.json$/.exec(url);
  if (row !== null) {
    const value = whole[row[1] ?? ""];
    return value === undefined ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(value), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};

const main = async (): Promise<void> => {
  const app = defineApp({ name: "catalogue", host: "web", stores: { catalogue: { adapter: "content" } } });
  const type = new ContentAdapterType({ base: "/site", fetch: fake });
  const store = await type.open(app, "catalogue", "", {}, false);

  const core = await store.query("guide", { where: { areas: { has: ["core"] } } });
  eq("has selects the rows whose list holds core", core.rows.map((row) => String(row["slug"])).join(","), "alpha,gamma");
  eq("and reports every match", String(core.total), "2");
  eq("the list file is fetched once", String(fetched.filter((url) => url === "/site/content/guide.json").length), "1");

  const extra = await store.query("guide", { where: { areas: { in: ["extra"] } } });
  eq("in selects by any listed value", extra.rows.map((row) => String(row["slug"])).join(","), "beta");

  const fields = await store.query("guide", { fields: ["title"] });
  ok("fields keeps the id and the named field", fields.rows.every((row) => row["id"] !== undefined && row["title"] !== undefined && row["areas"] === undefined));

  const ordered = await store.query("guide", { order: "title ASC", limit: 2 });
  eq("order sorts and limit pages", ordered.rows.map((row) => String(row["id"])).join(","), "alpha,beta");
  eq("limit keeps the whole match's total", String(ordered.total), "3");

  eq("count reads through the same rows", String(await store.count("guide", { areas: { has: ["core"] } })), "2");

  const alpha = await store.get("guide", "alpha");
  ok("get answers the whole row", Array.isArray(alpha?.["setup"]) && (alpha?.["setup"] as unknown[]).length === 2);
  const rowFetches = fetched.filter((url) => url === "/site/content/guide/alpha.json").length;
  const again = await store.get("guide", "alpha");
  ok("a second get uses the cached row", Array.isArray(again?.["cues"]));
  eq("and fetches no second time", String(fetched.filter((url) => url === "/site/content/guide/alpha.json").length), String(rowFetches));

  let refused = "";
  try {
    await store.insert("guide", { title: "Nope" });
  } catch (error) {
    refused = error instanceof Error ? error.message : String(error);
  }
  ok("a write rejects naming the model and the read-only store", refused.includes("guide") && refused.includes("read-only"));

  let offline = true;
  const flaky: typeof fetch = async (input) => (offline ? new Response("", { status: 503 }) : fake(input));
  const retrying = await new ContentAdapterType({ base: "/site", fetch: flaky }).open(app, "catalogue", "", {}, false);
  let failed = false;
  try {
    await retrying.query("guide", {});
  } catch {
    failed = true;
  }
  ok("a list that fails to load rejects", failed);
  offline = false;
  ok("and is read again on the next call", (await retrying.query("guide", {})).rows.length === 3);
  await retrying.close();

  await store.close();
  done();
};

await main();
