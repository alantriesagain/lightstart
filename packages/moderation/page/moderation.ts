/**
 * @file The page's `$moderated` decorator. A model that declares it has two
 * layers: the base adapter (the `api` store), where published rows live and
 * which a client never writes, and the model's `$shadow` store on the device,
 * where the signed-in person's pending rows wait in the model's own shape with
 * one marker, `pending: { id, op, by, provenance }`. A client write submits to
 * the server and keeps the row in the shadow; a read answers the viewer's
 * shadow rows first and the base after; a base row that carries a pending
 * row's provenance heals it away. `where.pending` picks one layer, `true` the
 * shadow alone and `false` the base alone. A `direct` or `importing` write
 * passes through to the base: the admin, a seed, a dev path.
 *
 * Importing this module registers the decorator. `configureModeration` sets
 * who the viewer is and how a submission is sent; the defaults read the
 * signed-in account from `@lightstart/auth`'s token and post to
 * `/api/moderation/submit`.
 */

import { appUrl } from "@lightstart/app/base.ts";
import { authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import { applyFields, registerAdapterDecorator } from "@lightstart/light/model/adapter";
import { pendingOf, provenanceOf, published as publishedEvent, submissionOf } from "../index.ts";

import type {
  AdapterDecorator,
  AdapterDecoratorContext,
  QueryOptions,
  QueryPage,
  Row,
  StorageAdapter,
  WhereClause,
  WriteOptions,
} from "@lightstart/light/model/types.ts";
import type { ModeratedOptions, PendingMarker } from "../types.ts";

const MARKER = "pending";

/** What a page may set for the decorator: who is viewing, and how a submission is sent. */
export interface ModerationPageOptions {
  /** The signed-in account's id, or null. The default decodes `@lightstart/auth`'s token. */
  viewer?: () => string | null;
  /** Sends `{ kind, payload }` and answers the submission's id. The default posts to `/api/moderation/submit`. */
  submit?: (kind: string, payload: Row) => Promise<{ id: string }>;
  /** The provenance hash of a submission id; `provenanceOf` by default. */
  provenance?: (id: string) => Promise<string>;
}

let configured: ModerationPageOptions = {};

/** Set the viewer, the submitter or the provenance the decorator uses; a test's seam. */
export const configureModeration = (options: ModerationPageOptions): void => {
  configured = { ...configured, ...options };
};

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const decodePart = (part: string): string | null => {
  try {
    return atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
  } catch {
    return null;
  }
};

/** The account id a JWT session token names, or null. */
export const viewerFromToken = (): string | null => {
  const token = readToken();
  const part = token === null ? null : token.split(".")[1];
  const decoded = typeof part === "string" ? decodePart(part) : null;
  if (decoded === null) return null;
  try {
    const payload: unknown = JSON.parse(decoded);
    const id = isRecord(payload) ? payload["sub"] : undefined;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
};

/** Sends a submission of a kind that is no model to the server, over the session. */
export const submitToServer = async (kind: string, payload: Row): Promise<{ id: string }> => {
  const response = await authFetch()(`${appUrl("")}${authPrefix()}/api/moderation/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submissionOf(kind, payload)),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(isRecord(value) && typeof value["error"] === "string" ? value["error"] : `the submission was not taken (${String(response.status)})`);
  const id = isRecord(value) ? value["id"] : undefined;
  if (typeof id !== "string" || id === "") throw new Error("the submission was not taken");
  return { id };
};

const viewer = (): string | null => (configured.viewer ?? viewerFromToken)();
const send = (kind: string, payload: Row): Promise<{ id: string }> => (configured.submit ?? submitToServer)(kind, payload);
const provenanceFor = (id: string): Promise<string> => (configured.provenance ?? provenanceOf)(id);

const withoutMarker = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== MARKER));
const withoutProvenance = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "provenance"));
const marksOf = (row: Row): string[] => (Array.isArray(row["provenance"]) ? (row["provenance"] as unknown[]).map(String) : []);

const splitWhere = (where: WhereClause | undefined): { where: WhereClause | undefined; layer: boolean | undefined } => {
  if (where === undefined || !(MARKER in where)) return { where, layer: undefined };
  const rest = Object.fromEntries(Object.entries(where).filter(([key]) => key !== MARKER));
  const layer = (where as Row)[MARKER];
  return { where: Object.keys(rest).length > 0 ? rest : undefined, layer: typeof layer === "boolean" ? layer : undefined };
};

const refused = (status: number, message: string): Error => Object.assign(new Error(message), { status });

const page = (rows: Row[], limit: number | undefined, offset: number): Row[] => (limit === undefined ? rows.slice(offset) : rows.slice(offset, offset + limit));

/**
 * The `$moderated` decorator over a routed adapter and its `$shadow`. It
 * delegates method by method; the base keeps its own state.
 */
export const moderated: AdapterDecorator = (base: StorageAdapter, { model, schema, shadow, changed }: AdapterDecoratorContext): StorageAdapter => {
  if (shadow === null) throw new Error(`$moderated model "${model}" declares no $shadow adapter`);
  const raw = schema?.["$moderated"];
  const options: ModeratedOptions = raw === true || raw === undefined ? {} : (raw as ModeratedOptions);
  const hasSlug = Boolean(schema?.["slug"]);

  const own = async (opts: QueryOptions = {}): Promise<Row[]> => {
    const by = viewer();
    if (by === null) return [];
    const { rows } = await shadow.query(model, opts);
    return rows.filter((row) => pendingOf(row)?.by === by);
  };

  const ownById = async (id: string | number): Promise<Row | null> => {
    const row = await shadow.get(model, id);
    return row !== null && pendingOf(row)?.by === viewer() ? row : null;
  };

  const project = (rows: Row[], fields: string[] | undefined): Row[] => (fields === undefined ? rows : applyFields(rows, [...fields, MARKER]));

  const heal = async (pending: Row[], baseRows: Row[]): Promise<Set<string>> => {
    const healed = new Set<string>();
    if (pending.length === 0 || baseRows.length === 0) return healed;
    for (const row of pending) {
      const marker = pendingOf(row) as PendingMarker;
      const published = baseRows.find((candidate) => marksOf(candidate).includes(marker.provenance));
      if (published === undefined) continue;
      healed.add(marker.id);
      await shadow.delete(model, row.id as string | number);
      setTimeout(() => {
        changed({ model, action: "remove", row });
        void publishedEvent.emit({ model, id: marker.id, key: row.id, row: published });
      }, 0);
    }
    return healed;
  };

  const enqueue = async (kind: string, payload: Row): Promise<string> => {
    const sent = await send(kind, payload);
    if (!sent.id) throw new Error("the submission was not taken");
    return sent.id;
  };

  const opOf = (row: Row): PendingMarker["op"] | undefined => pendingOf(row)?.op;

  const adapter: StorageAdapter = {
    init: () => base.init(),
    close: () => base.close(),

    async query(m: string, opts: QueryOptions = {}): Promise<QueryPage> {
      const { where, layer } = splitWhere(opts.where);
      const selection: QueryOptions = { ...opts, where };
      if (layer === false) return base.query(m, selection);
      const pending = await own({ ...(where === undefined ? {} : { where }), ...(opts.order === undefined ? {} : { order: opts.order }) });
      const offset = opts.offset ?? 0;
      if (layer === true) {
        const healed = hasSlug && pending.length > 0
          ? await heal(pending, (await base.query(m, { where: { slug: { in: pending.map((row) => row["slug"]) } }, fields: ["slug", "provenance"] })).rows)
          : new Set<string>();
        const live = pending.filter((row) => !healed.has((pendingOf(row) as PendingMarker).id));
        return { rows: project(page(live, opts.limit, offset), opts.fields), total: live.length };
      }
      if (pending.length === 0) return base.query(m, selection);
      const adds = pending.filter((row) => opOf(row) === "add");
      const edits = new Map(pending.filter((row) => opOf(row) === "edit").map((row) => [String(row.id), row]));
      const addsPage = page(adds, opts.limit, offset);
      const baseLimit = opts.limit === undefined ? undefined : opts.limit - addsPage.length;
      const asked = opts.fields === undefined || (opts.fields as string[]).includes("provenance");
      let baseRows: Row[] = [];
      let total = 0;
      if (baseLimit === 0) total = opts.total === false ? 0 : await base.count(m, where);
      else {
        const result = await base.query(m, {
          ...selection,
          offset: Math.max(0, offset - adds.length),
          ...(baseLimit === undefined ? {} : { limit: baseLimit }),
          ...(asked || opts.fields === undefined ? {} : { fields: [...(opts.fields as string[]), "provenance"] }),
        });
        baseRows = result.rows;
        total = result.total;
      }
      const healed = await heal(pending, baseRows);
      const rows = baseRows.map((row) => {
        const edit = edits.get(String(row.id));
        if (edit !== undefined && !healed.has((pendingOf(edit) as PendingMarker).id)) return project([edit], opts.fields)[0] as Row;
        return asked ? row : withoutProvenance(row);
      });
      const liveAdds = addsPage.filter((row) => !healed.has((pendingOf(row) as PendingMarker).id));
      const healedAdds = adds.length - adds.filter((row) => !healed.has((pendingOf(row) as PendingMarker).id)).length;
      return { rows: [...project(liveAdds, opts.fields), ...rows], total: total + adds.length - healedAdds };
    },

    async get(m: string, id: string | number, opts?: Pick<QueryOptions, "locale">): Promise<Row | null> {
      return (await ownById(id)) ?? base.get(m, id, opts);
    },

    async count(m: string, where?: WhereClause): Promise<number> {
      const split = splitWhere(where);
      if (split.layer === false) return base.count(m, split.where);
      const adds = (await own(split.where === undefined ? {} : { where: split.where })).filter((row) => opOf(row) === "add").length;
      return split.layer === true ? adds : adds + (await base.count(m, split.where));
    },

    async insert(m: string, row: Row, opts: WriteOptions = {}): Promise<Row> {
      if (opts.direct === true || opts.importing === true) return base.insert(m, row, opts);
      const by = viewer();
      if (by === null) throw refused(401, "sign in first");
      const payload = withoutMarker(row);
      const id = await enqueue(model, payload);
      if (options.single === true)
        for (const old of await own()) if (opOf(old) === "add") await shadow.delete(m, old.id as string | number);
      return shadow.insert(m, { ...payload, [MARKER]: { id, op: "add", by, provenance: await provenanceFor(id) } });
    },

    async insertMany(m: string, rows: Row[], opts: WriteOptions = {}): Promise<Row[]> {
      if ((opts.direct === true || opts.importing === true) && base.insertMany !== undefined) return base.insertMany(m, rows, opts);
      const out: Row[] = [];
      for (const row of rows) out.push(await adapter.insert(m, row, opts));
      return out;
    },

    async update(m: string, merged: Row, opts: WriteOptions = {}): Promise<Row> {
      if (opts.direct === true) return base.update(m, merged, opts);
      const by = viewer();
      if (by === null) throw refused(401, "sign in first");
      const id = merged.id as string | number;
      const existing = await ownById(id);
      if (existing !== null && opOf(existing) === "add") return shadow.update(m, { ...withoutMarker(merged), [MARKER]: existing[MARKER] });
      if (options.edit !== true) throw refused(403, `${m} is not edited from a client`);
      const sid = await enqueue(`${m}.edit`, { ...withoutMarker(opts.patch ?? {}), targetType: m, targetSlug: String(id) });
      const row = { ...withoutMarker(merged), [MARKER]: { id: sid, op: "edit", by, provenance: await provenanceFor(sid) } };
      return existing !== null ? shadow.update(m, row) : shadow.insert(m, row);
    },

    async delete(m: string, id: string | number, opts: WriteOptions = {}): Promise<unknown> {
      if (opts.direct === true) return base.delete(m, id, opts);
      if ((await ownById(id)) === null) throw refused(403, `${m} ${String(id)} is published; a client does not remove it`);
      return shadow.delete(m, id);
    },
  };

  const { nextId, exists, facets, truncate, supportsOperator, subscribe, invalidate } = base;
  if (nextId !== undefined) adapter.nextId = (m: string, row: Row): string | number => nextId.call(base, m, row);
  if (exists !== undefined)
    adapter.exists = async (m: string, where?: WhereClause): Promise<boolean> => {
      const split = splitWhere(where);
      if (split.layer === false) return exists.call(base, m, split.where);
      if ((await own(split.where === undefined ? {} : { where: split.where })).some((row) => opOf(row) === "add")) return true;
      return split.layer === true ? false : exists.call(base, m, split.where);
    };
  if (facets !== undefined) adapter.facets = (m, fields, opts) => facets.call(base, m, fields, opts);
  if (truncate !== undefined) adapter.truncate = (m) => truncate.call(base, m);
  if (supportsOperator !== undefined) adapter.supportsOperator = (operator) => supportsOperator.call(base, operator);
  if (subscribe !== undefined) adapter.subscribe = (m, cb) => subscribe.call(base, m, cb);
  if (invalidate !== undefined) adapter.invalidate = (m) => invalidate.call(base, m);
  return adapter;
};

/** Register the `$moderated` decorator; importing the module already does. */
export const registerModeration = (): void => registerAdapterDecorator("$moderated", moderated);

registerModeration();
