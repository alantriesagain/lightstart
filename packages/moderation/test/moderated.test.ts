// node-only
/**
 * @file The `$moderated` adapter decorator over a fake store: a write submits
 * and waits in the shadow, reads answer the pending rows first, the layers can
 * be picked, a published row heals its pending one, and a direct or importing
 * write reaches the base.
 */

import { buildQueryResult } from "@lightstart/light/model/adapter";
import { createStore } from "@lightstart/light/model/store";
import { pendingOf, provenanceOf, published as publishedEvent } from "../index.ts";
import { done } from "@lightstart/test/assert.ts";
import { configureModeration } from "../page/moderation.ts";

import type { ModelSchema, QueryOptions, Row, StorageAdapter } from "@lightstart/light/model/types.ts";
import type { ModerationPublished, PendingMarker } from "../types.ts";

const memoryAdapter = ({ slugIds = false } = {}) => {
  const tables = new Map<string, Map<string, Row>>();
  const calls: unknown[] = [];
  const table = (model: string): Map<string, Row> => {
    if (!tables.has(model)) tables.set(model, new Map());
    return tables.get(model) as Map<string, Row>;
  };
  const adapter: StorageAdapter & { calls: unknown[]; tables: Map<string, Map<string, Row>> } = {
    calls,
    tables,
    async init() {},
    async get(model, id) {
      return table(model).get(String(id)) ?? null;
    },
    async query(model, opts: QueryOptions = {}) {
      calls.push(["query", model, opts]);
      const result = buildQueryResult([...table(model).values()], opts);
      return { rows: result.items, total: result.total };
    },
    async insert(model, row) {
      calls.push(["insert", model, row]);
      if (table(model).has(String(row.id))) throw new Error(`duplicate ${String(row.id)}`);
      table(model).set(String(row.id), row);
      return row;
    },
    async update(model, row) {
      table(model).set(String(row.id), row);
      return row;
    },
    async delete(model, id) {
      calls.push(["delete", model, id]);
      table(model).delete(String(id));
      return true;
    },
    async count(model, where) {
      return (await adapter.query(model, { where })).total;
    },
    async close() {},
  };
  if (slugIds) adapter.nextId = (_model, row) => String(row["slug"]);
  return adapter;
};

const schemaOf = (): Record<string, ModelSchema> => ({
  place: { $store: "file", $shadow: "indexeddb", $moderated: { edit: true }, name: { $type: "string" }, slug: { $type: "string" }, area: { $type: "string" }, provenance: { $type: "array" } },
  spot: { $store: "file", $shadow: "indexeddb", $moderated: { single: true }, name: { $type: "string" }, provenance: { $type: "array" } },
}) as unknown as Record<string, ModelSchema>;

const PLACES: Row[] = [
  { id: "bar-a", slug: "bar-a", name: "Bar A", area: "Lapa", provenance: [] },
  { id: "bar-b", slug: "bar-b", name: "Bar B", area: "Centro", provenance: [] },
  { id: "bar-c", slug: "bar-c", name: "Bar C", area: "Lapa", provenance: [] },
];

const ids = (rows: Row[]): Array<string | number | undefined> => rows.map((row) => row.id);

const main = async (): Promise<void> => {
  let viewer: string | null = "alice";
  let sends: Array<{ kind: string; payload: Row }> = [];
  configureModeration({
    viewer: () => viewer,
    submit: async (kind, payload) => {
      sends.push({ kind, payload });
      return { id: `s${String(sends.length)}` };
    },
  });
  const setup = () => {
    const base = memoryAdapter({ slugIds: true });
    const shadow = memoryAdapter();
    const emitted: Array<{ model: string; action: string; row?: Row }> = [];
    const store = createStore({ models: schemaOf(), databases: { file: base, indexeddb: shadow, main: shadow }, defaultAdapter: "indexeddb", changed: (change) => emitted.push(change) });
    sends = [];
    return { store, base, shadow, emitted };
  };
  const published = async (base: ReturnType<typeof memoryAdapter>, rows: Row[]): Promise<void> => {
    for (const row of rows) await base.insert("place", row);
  };
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  const add = async (): Promise<void> => {
    const { store, base, shadow } = setup();
    const row = await store.add("place", { name: "Café Z", slug: "cafe-z", area: "Lapa" });
    if (sends.length !== 1) throw new Error("an add did not submit once");
    const sent = sends[0] as { kind: string; payload: Row };
    if (sent.kind !== "place") throw new Error("the kind is not the model");
    if (base.tables.get("place")?.size !== undefined && (base.tables.get("place")?.size ?? 0) !== 0) throw new Error("the base took a client write");
    const marker = pendingOf(row) as PendingMarker;
    const provenance = await provenanceOf(marker.id);
    if (marker.op !== "add" || marker.by !== "alice" || marker.provenance !== provenance) throw new Error("the marker is wrong");
    if ((shadow.tables.get("place")?.size ?? 0) !== 1) throw new Error("the shadow did not keep the row");
  };

  const edit = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    const edited = await store.edit("place", "bar-a", { area: "Botafogo" });
    const sent = sends[sends.length - 1] as { kind: string; payload: Row };
    if (sent.kind !== "place.edit" || sent.payload["targetSlug"] !== "bar-a" || sent.payload["targetType"] !== "place") throw new Error("the edit was not submitted as a patch");
    if ((pendingOf(edited) as PendingMarker).op !== "edit") throw new Error("the edit is not marked");
    if ((await store.get("place", "bar-a"))?.["area"] !== "Botafogo") throw new Error("the overlay did not stand in");
    if ((await base.get("place", "bar-a"))?.["area"] !== "Lapa") throw new Error("the base changed");
    const again = await store.edit("place", "bar-a", { name: "Bar A2" });
    if (again["name"] !== "Bar A2" || again["area"] !== "Botafogo" || (pendingOf(again) as PendingMarker).id !== "s2") throw new Error("a second edit did not replace the overlay");
    const all = await store.query("place", { order: "slug" });
    if (all.rows.length !== 3 || all.rows[0]?.["name"] !== "Bar A2") throw new Error("the overlay did not take the published row's place");
  };

  const localEdit = async (): Promise<void> => {
    const { store } = setup();
    await store.add("place", { name: "Café Z", slug: "cafe-z", area: "Lapa" });
    const before = sends.length;
    const local = await store.edit("place", "cafe-z", { area: "Centro" });
    if (sends.length !== before) throw new Error("an edit of a pending add was submitted");
    if (local["area"] !== "Centro" || (pendingOf(local) as PendingMarker).op !== "add") throw new Error("the pending add was not patched on the device");
  };

  const noEdit = async (): Promise<void> => {
    const { store, base } = setup();
    await base.insert("spot", { id: "x1", name: "X", provenance: [] });
    try {
      await store.edit("spot", "x1", { name: "Y" });
      throw new Error("the edit was allowed");
    } catch (error) {
      if ((error as { status?: number }).status !== 403) throw error;
    }
  };

  const remove = async (): Promise<void> => {
    const { store, base, shadow } = setup();
    await published(base, PLACES);
    await store.add("place", { name: "Café Z", slug: "cafe-z" });
    await store.remove("place", "cafe-z");
    if ((shadow.tables.get("place")?.size ?? 0) !== 0 || (base.tables.get("place")?.size ?? 0) !== 3) throw new Error("removing a pending row touched the base");
    try {
      await store.remove("place", "bar-a");
      throw new Error("a published row was removed");
    } catch (error) {
      if (!String(error).includes("published")) throw error;
    }
    await store.add("place", { name: "One", slug: "one" });
    await store.add("place", { name: "Two", slug: "two" });
    if ((await store.removeAll("place", { pending: true })) !== 2) throw new Error("removeAll did not drop both pending rows");
  };

  const direct = async (): Promise<void> => {
    const { store, base, shadow } = setup();
    await store.add("place", { name: "Admin", slug: "admin" }, { direct: true });
    if (base.tables.get("place")?.get("admin")?.["name"] !== "Admin") throw new Error("a direct write did not reach the base");
    if (sends.length !== 0 || (shadow.tables.get("place")?.size ?? 0) !== 0) throw new Error("a direct write was moderated");
    await store.addMany("spot", [{ id: "a", name: "a" }, { id: "b", name: "b" }], { importing: true });
    if ((base.tables.get("spot")?.size ?? 0) !== 2) throw new Error("an importing addMany did not reach the base");
    await store.addMany("spot", [{ id: "c", name: "c" }, { id: "d", name: "d" }]);
    if ((sends.length as number) !== 2 || (shadow.tables.get("spot")?.size ?? 0) !== 1) throw new Error("a moderated addMany did not keep one pending add");
    if ([...(shadow.tables.get("spot")?.values() ?? [])][0]?.["name"] !== "d") throw new Error("the last single add did not replace the first");
  };

  const signedOut = async (): Promise<void> => {
    const { store } = setup();
    viewer = null;
    try {
      await store.add("place", { name: "N", slug: "n" });
      throw new Error("a signed-out write was taken");
    } catch (error) {
      if ((error as { status?: number }).status !== 401) throw error;
    }
    if (sends.length !== 0) throw new Error("a signed-out write was submitted");
    viewer = "alice";
  };

  const noShadow = async (): Promise<void> => {
    const base = memoryAdapter();
    const store = createStore({ models: { thing: { $store: "file", $moderated: true, n: { $type: "number" } } } as unknown as Record<string, ModelSchema>, databases: { file: base }, defaultAdapter: "file" });
    try {
      await store.add("thing", { n: 1 });
      throw new Error("a model without a shadow was taken");
    } catch (error) {
      if (!String(error).includes("declares no $shadow")) throw error;
    }
  };

  const reads = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    await store.add("place", { name: "P1", slug: "p1", area: "Lapa" });
    await store.add("place", { name: "P2", slug: "p2", area: "Centro" });
    const all = await store.query("place", { order: "slug" });
    if (ids(all.rows).join(",") !== "p1,p2,bar-a,bar-b,bar-c" || all.total !== 5) throw new Error("the read did not answer both layers");
    if (ids((await store.query("place", { order: "slug", limit: 2, offset: 1 })).rows).join(",") !== "p2,bar-a") throw new Error("the window was not re-offset");
    const lapa = await store.query("place", { where: { area: "Lapa" }, order: "slug" });
    if (ids(lapa.rows).join(",") !== "p1,bar-a,bar-c" || lapa.total !== 3) throw new Error("a where did not read both layers");
    if ((await store.count("place", { where: { area: "Lapa" } })) !== 3) throw new Error("count did not read both layers");
    if ((await store.exists("place", { slug: "p1" })) !== true) throw new Error("exists missed a pending row");
    if ((await store.exists("place", { slug: "nope" })) !== false) throw new Error("exists found nothing somewhere");
  };

  const projection = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    await store.add("place", { name: "P1", slug: "p1", area: "Lapa" });
    const { rows } = await store.query("place", { fields: ["name"], order: "slug" });
    if (rows[0]?.["pending"] === undefined) throw new Error("the marker was projected away");
    if (rows[1]?.["provenance"] !== undefined) throw new Error("the provenance leaked into a published row");
    const asked = await store.query("place", { fields: ["name", "provenance"], where: { pending: false } });
    if (asked.rows[0]?.["provenance"] === undefined) throw new Error("an asked-for provenance was dropped");
  };

  const layers = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    await store.add("place", { name: "P1", slug: "p1", area: "Lapa" });
    const mine = await store.query("place", { where: { pending: true } });
    if (ids(mine.rows).join(",") !== "p1" || mine.total !== 1) throw new Error("where.pending true did not answer the shadow alone");
    const theirs = await store.query("place", { where: { pending: false, area: "Lapa" }, order: "slug" });
    if (ids(theirs.rows).join(",") !== "bar-a,bar-c") throw new Error("where.pending false did not answer the base alone");
    if ((await store.count("place", { where: { pending: true } })) !== 1) throw new Error("count did not pick the shadow");
    if ((await store.getAll("place", { where: { pending: true, area: "Centro" } })).length !== 0) throw new Error("a where.pending read ignored the rest of the where");
  };

  const viewers = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    await store.add("place", { name: "P1", slug: "p1", area: "Lapa" });
    viewer = "bob";
    if (ids((await store.query("place", { order: "slug" })).rows).join(",") !== "bar-a,bar-b,bar-c") throw new Error("another viewer saw the pending row");
    if ((await store.get("place", "p1")) !== null) throw new Error("another viewer got the pending row");
    viewer = "alice";
    if ((await store.query("place", {})).total !== 4) throw new Error("the sender did not see their row again");
  };

  const healing = async (): Promise<void> => {
    const { store, base, shadow } = setup();
    await published(base, PLACES);
    const pending = await store.add("place", { name: "Café Z", slug: "cafe-z", area: "Lapa" });
    const marker = pendingOf(pending) as PendingMarker;
    await base.insert("place", { id: "cafe-z", slug: "cafe-z", name: "Café Z", area: "Lapa", provenance: [marker.provenance] });
    const events: ModerationPublished[] = [];
    const stop = publishedEvent.on((event) => events.push(event));
    const { rows, total } = await store.query("place", { order: "slug" });
    if (ids(rows).join(",") !== "bar-a,bar-b,bar-c,cafe-z" || total !== 4) throw new Error("the healed read did not answer the published row");
    if (pendingOf(rows[3]) !== null) throw new Error("the published row still carries a marker");
    if ((shadow.tables.get("place")?.size ?? 0) !== 0) throw new Error("the shadow was not healed");
    await settle();
    stop();
    if (events.length !== 1 || events[0]?.id !== marker.id || events[0]?.key !== "cafe-z") throw new Error("the published event did not name the healed row");
  };

  const healingBySlug = async (): Promise<void> => {
    const { store, base } = setup();
    await store.add("place", { name: "One", slug: "one", area: "Lapa" });
    await store.add("place", { name: "Two", slug: "two", area: "Lapa" });
    const one = (await store.get("place", "one")) as Row;
    await base.insert("place", { id: "one", slug: "one", name: "One", area: "Lapa", provenance: [(pendingOf(one) as PendingMarker).provenance] });
    const { rows } = await store.query("place", { where: { pending: true } });
    if (ids(rows).join(",") !== "two") throw new Error("a pending-only read did not heal by slug");
    await settle();
  };

  const healEdit = async (): Promise<void> => {
    const { store, base } = setup();
    await published(base, PLACES);
    const edited = await store.edit("place", "bar-a", { area: "Botafogo" });
    await base.update("place", { ...PLACES[0], area: "Botafogo", provenance: [(pendingOf(edited) as PendingMarker).provenance] });
    const { rows } = await store.query("place", { where: { slug: "bar-a" } });
    if (rows[0]?.["area"] !== "Botafogo" || pendingOf(rows[0]) !== null) throw new Error("a healed edit did not give the published row back");
    await settle();
  };

  await add();
  await edit();
  await localEdit();
  await noEdit();
  await remove();
  await direct();
  await signedOut();
  await noShadow();
  await reads();
  await projection();
  await layers();
  await viewers();
  await healing();
  await healingBySlug();
  await healEdit();

  done();
};

await main();
