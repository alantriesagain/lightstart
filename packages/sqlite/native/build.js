/**
 * @file Build SQLite's amalgamation and the shim into `native/out/libsqlite.a`,
 * then write `native/ffi.json` beside it. Run as this package's prepare step;
 * the same command works on a clean checkout and leaves the archive alone when
 * the sources are older.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const source = join(here, "vendor", "sqlite3.c");
const header = join(here, "vendor", "sqlite3.h");
const shim = join(here, "shim.c");
const archive = join(out, "libsqlite.a");

const FUNCTIONS = [
  { name: "sqlite_shim_open", symbol: "sqlite_shim_open", params: ["string", "i32"], returns: "pointer" },
  { name: "sqlite_shim_close", symbol: "sqlite_shim_close", params: ["pointer"], returns: "void" },
  { name: "sqlite_shim_errmsg", symbol: "sqlite_shim_errmsg", params: ["pointer", "mutable-bytes"], returns: "i32" },
  { name: "sqlite_shim_prepare", symbol: "sqlite_shim_prepare", params: ["pointer", "string"], returns: "pointer" },
  { name: "sqlite_shim_finalize", symbol: "sqlite_shim_finalize", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_bind_null", symbol: "sqlite_shim_bind_null", params: ["pointer", "i32"], returns: "i32" },
  { name: "sqlite_shim_bind_double", symbol: "sqlite_shim_bind_double", params: ["pointer", "i32", "f64"], returns: "i32" },
  { name: "sqlite_shim_bind_int", symbol: "sqlite_shim_bind_int", params: ["pointer", "i32", "i64"], returns: "i32" },
  { name: "sqlite_shim_bind_int32", symbol: "sqlite_shim_bind_int32", params: ["pointer", "i32", "i32"], returns: "i32" },
  { name: "sqlite_shim_bind_text", symbol: "sqlite_shim_bind_text", params: ["pointer", "i32", "string"], returns: "i32" },
  { name: "sqlite_shim_bind_blob", symbol: "sqlite_shim_bind_blob", params: ["pointer", "i32", "bytes"], returns: "i32" },
  { name: "sqlite_shim_bind_index", symbol: "sqlite_shim_bind_index", params: ["pointer", "string"], returns: "i32" },
  { name: "sqlite_shim_clear_bindings", symbol: "sqlite_shim_clear_bindings", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_ready", symbol: "sqlite_shim_ready", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_reset", symbol: "sqlite_shim_reset", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_json", symbol: "sqlite_shim_json", params: ["pointer", "mutable-bytes"], returns: "i64" },
  { name: "sqlite_shim_readonly", symbol: "sqlite_shim_readonly", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_columns", symbol: "sqlite_shim_columns", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_row", symbol: "sqlite_shim_row", params: ["pointer", "mutable-bytes"], returns: "i64" },
  { name: "sqlite_shim_get_text", symbol: "sqlite_shim_get_text", params: ["pointer", "string", "u32", "mutable-bytes"], returns: "i64" },
  { name: "sqlite_shim_get_int", symbol: "sqlite_shim_get_int", params: ["pointer", "i64", "u32", "mutable-bytes"], returns: "i64" },
  { name: "sqlite_shim_run", symbol: "sqlite_shim_run", params: ["pointer"], returns: "i32" },
  { name: "sqlite_shim_changes", symbol: "sqlite_shim_changes", params: ["pointer"], returns: "i64" },
  { name: "sqlite_shim_last_id", symbol: "sqlite_shim_last_id", params: ["pointer"], returns: "i64" },
  { name: "sqlite_shim_exec", symbol: "sqlite_shim_exec", params: ["pointer", "string"], returns: "i32" },
];

/**
 * @param {string} command
 * @param {string[]} args
 */
const run = (command, args) => execFileSync(command, args, { cwd: here, stdio: "inherit" });

/**
 * @param {string} file
 * @returns {number}
 */
const newest = (file) => statSync(file).mtimeMs;
const current = existsSync(archive) && existsSync(join(here, "ffi.json")) &&
  newest(archive) > Math.max(newest(source), newest(header), newest(shim), newest(fileURLToPath(import.meta.url)));

if (!current) {
  mkdirSync(out, { recursive: true });
  const flags = [
    "-O2", "-fPIC",
    "-DSQLITE_THREADSAFE=2",
    "-DSQLITE_DEFAULT_MEMSTATUS=0",
    "-DSQLITE_DQS=0",
    "-DSQLITE_OMIT_DEPRECATED",
    "-DSQLITE_OMIT_SHARED_CACHE",
    "-DSQLITE_LIKE_DOESNT_MATCH_BLOBS",
    "-DSQLITE_USE_ALLOCA",
    "-DSQLITE_DEFAULT_FOREIGN_KEYS=1",
    "-I" + join(here, "vendor"),
  ];
  run("cc", [...flags, "-c", source, "-o", join(out, "sqlite3.o")]);
  run("cc", [...flags, "-c", shim, "-o", join(out, "shim.o")]);
  run("ar", ["rcs", archive, join(out, "sqlite3.o"), join(out, "shim.o")]);
}

const systemLibraries = process.platform === "darwin" ? ["m"] : ["m", "dl", "pthread"];
const manifest = { ffi_format: 7, functions: FUNCTIONS, libraries: ["./out/libsqlite.a"], system_libraries: systemLibraries };
writeFileSync(join(here, "ffi.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("sqlite: " + archive);
