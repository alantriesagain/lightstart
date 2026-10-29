/**
 * @file The sqlite shim's calls on node's own engine, for running the native
 * driver's tests under node: preloaded with `node --import`, it defines the
 * functions the FFI binds natively, backed by node:sqlite. A statement's
 * bindings are kept by parameter index, the way the native shim keeps them.
 */
import { DatabaseSync } from "node:sqlite";

const databases = new Map();
const statements = new Map();
let nextHandle = 1n;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const parseParams = (sql) => {
  const names = new Map();
  let count = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      i++;
      while (i < sql.length && sql[i] !== quote) i++;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === "?") {
      let digits = "";
      let j = i + 1;
      while (j < sql.length && /\d/.test(sql[j])) {
        digits += sql[j];
        j++;
      }
      if (digits !== "") {
        count = Math.max(count, Number(digits));
        i = j - 1;
      } else count += 1;
      continue;
    }
    if (c === ":" || c === "@" || c === "$") {
      let j = i + 1;
      let name = "";
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) {
        name += sql[j];
        j++;
      }
      if (name !== "") {
        count += 1;
        names.set(name, count);
        i = j - 1;
      }
    }
  }
  return { names, count };
};

const valuesOf = (handle) => {
  const { params, count, names } = handle;
  if (names.size > 0) {
    const values = {};
    for (const [name, index] of names) values[name] = params.has(index) ? params.get(index) : null;
    return values;
  }
  const values = [];
  for (let i = 1; i <= count; i++) values.push(params.has(i) ? params.get(i) : null);
  return values;
};

const apply = (statement, method) => {
  const values = valuesOf(statement);
  return Array.isArray(values) ? statement.statement[method](...values) : statement.statement[method](values);
};

const statementOf = (handle) => {
  if (handle === 0n) throw new Error("sqlite: no statement");
  const found = statements.get(handle);
  if (found === undefined) throw new Error("sqlite: statement is closed");
  return found;
};

const databaseOf = (handle) => {
  const found = databases.get(handle);
  if (found === undefined) throw new Error("sqlite: no database");
  return found;
};

const setError = (handle, error) => {
  const db = databases.get(handle);
  if (db !== undefined) db.error = error instanceof Error ? error.message : String(error);
};

globalThis.sqlite_shim_open = (path, readOnly) => {
  const handle = nextHandle++;
  try {
    const db = new DatabaseSync(path, { readOnly: readOnly === 1 });
    databases.set(handle, { db, error: "", changes: 0, lastId: 0 });
    return handle;
  } catch (error) {
    databases.set(handle, { db: null, error: error instanceof Error ? error.message : String(error), changes: 0, lastId: 0 });
    return 0n;
  }
};

globalThis.sqlite_shim_close = (handle) => {
  const db = databases.get(handle);
  if (db !== undefined && db.db !== null) db.db.close();
  databases.delete(handle);
};

globalThis.sqlite_shim_errmsg = (handle, buffer) => {
  const db = databases.get(handle);
  const message = db === undefined ? "sqlite: no database" : db.error;
  const bytes = encoder.encode(message);
  if (buffer.length < bytes.length + 1) return -(bytes.length + 1);
  buffer.set(bytes, 0);
  buffer[bytes.length] = 0;
  return bytes.length;
};

globalThis.sqlite_shim_prepare = (handle, sql) => {
  const db = databaseOf(handle);
  try {
    const stmt = db.db.prepare(sql);
    const { names, count } = parseParams(sql);
    const statement = nextHandle++;
    statements.set(statement, { db: handle, statement: stmt, params: new Map(), names, count });
    return statement;
  } catch (error) {
    setError(handle, error);
    return 0n;
  }
};

globalThis.sqlite_shim_finalize = (handle) => {
  statements.delete(handle);
  return 0;
};

const setParam = (handle, index, value) => {
  const statement = statementOf(handle);
  if (index > 0) statement.params.set(index, value);
  return 0;
};

globalThis.sqlite_shim_bind_null = (handle, index) => setParam(handle, index, null);
globalThis.sqlite_shim_bind_double = (handle, index, value) => setParam(handle, index, value);
globalThis.sqlite_shim_bind_int = (handle, index, value) => setParam(handle, index, value);
globalThis.sqlite_shim_bind_text = (handle, index, value) => setParam(handle, index, value);
globalThis.sqlite_shim_bind_blob = (handle, index, value) => setParam(handle, index, value);

globalThis.sqlite_shim_bind_index = (handle, name) => {
  const statement = statementOf(handle);
  const bare = name[0] === ":" || name[0] === "@" || name[0] === "$" ? name.slice(1) : name;
  return statement.names.get(bare) ?? 0;
};

globalThis.sqlite_shim_clear_bindings = (handle) => {
  statementOf(handle).params.clear();
  return 0;
};

globalThis.sqlite_shim_reset = () => 0;
globalThis.sqlite_shim_step = () => 0;

globalThis.sqlite_shim_json = (handle, buffer) => {
  const statement = statementOf(handle);
  try {
    const rows = apply(statement, "all");
    const json = JSON.stringify(rows);
    const bytes = encoder.encode(json);
    if (buffer.length < bytes.length + 1) return -(bytes.length + 1);
    buffer.set(bytes, 0);
    return bytes.length;
  } catch (error) {
    setError(statement.db, error);
    return -2;
  }
};

globalThis.sqlite_shim_run = (handle) => {
  const statement = statementOf(handle);
  try {
    const result = apply(statement, "run");
    const db = databaseOf(statement.db);
    db.changes = Number(result.changes);
    db.lastId = result.lastInsertRowid;
    return 101;
  } catch (error) {
    setError(statement.db, error);
    return 1;
  }
};

globalThis.sqlite_shim_changes = (handle) => BigInt(databaseOf(handle).changes);
globalThis.sqlite_shim_last_id = (handle) => BigInt(databaseOf(handle).lastId);

globalThis.sqlite_shim_exec = (handle, sql) => {
  const db = databaseOf(handle);
  try {
    db.db.exec(sql);
    return 0;
  } catch (error) {
    setError(handle, error);
    return 1;
  }
};

export { decoder };
