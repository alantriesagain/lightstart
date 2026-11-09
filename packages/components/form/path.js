/**
 * Reading and writing a value at a form field's name.
 *
 * A field name is a path, not a key: `links[0].url` addresses one entry of a
 * repeated group. The form holds one values object and every control addresses
 * its own leaf, so these four functions are the whole contract between a
 * nested field list and the payload it produces.
 */

/**
 * `"a.b[0].c"` as `["a", "b", 0, "c"]`. A numeric segment stays a number, so
 * a missing container is created as the array or the object it needs to be.
 * @param {string} path
 * @returns {Array<string | number>}
 */
export const parsePath = (path) =>
  String(path)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment !== "")
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));

/**
 * @param {unknown} source
 * @param {string} path
 * @returns {unknown}
 */
export const getPath = (source, path) => {
  let value = source;
  for (const segment of parsePath(path)) {
    if (value == null || typeof value !== "object") return undefined;
    value = /** @type {Record<string | number, unknown>} */ (value)[segment];
  }
  return value;
};

/**
 * Write `value` at `path`, creating the containers on the way. Returns the
 * same target, mutated: the engine holds one values object for the life of
 * the form.
 * @template {Record<string, unknown>} T
 * @param {T} target
 * @param {string} path
 * @param {unknown} value
 * @returns {T}
 */
export const setPath = (target, path, value) => {
  const segments = parsePath(path);
  if (!segments.length) return target;
  let cursor = /** @type {Record<string | number, unknown>} */ (target);
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = cursor[segment];
    if (next == null || typeof next !== "object")
      cursor[segment] = typeof segments[i + 1] === "number" ? [] : {};
    cursor = /** @type {Record<string | number, unknown>} */ (cursor[segment]);
  }
  cursor[segments[segments.length - 1]] = value;
  return target;
};

/**
 * Remove what is at `path`. An array entry is spliced out, so the indices
 * after it close up rather than leaving a hole a renderer would draw.
 * @template {Record<string, unknown>} T
 * @param {T} target
 * @param {string} path
 * @returns {T}
 */
export const deletePath = (target, path) => {
  const segments = parsePath(path);
  if (!segments.length) return target;
  let cursor = /** @type {Record<string | number, unknown> | undefined} */ (target);
  for (let i = 0; i < segments.length - 1; i++) {
    if (cursor == null || typeof cursor !== "object") return target;
    cursor = /** @type {Record<string | number, unknown> | undefined} */ (cursor[segments[i]]);
  }
  if (cursor == null || typeof cursor !== "object") return target;
  const last = segments[segments.length - 1];
  if (Array.isArray(cursor) && typeof last === "number") cursor.splice(last, 1);
  else delete cursor[last];
  return target;
};
