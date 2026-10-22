/**
 * @bootstrapp/light/check/component-index.js: every tag a project can
 * render, from its own component map and from each map a host adds (its
 * dependencies, its extension units), with the source and the declared props
 * behind each tag. The project's parsed views come first, then the maps in
 * order; the first writer of a tag wins.
 */

import path from "node:path";
import { definitionOf, parseComponentSources } from "./parse/component.js";
import { toRel } from "./walk.js";

/** @import { ComponentIndex, ComponentMap, ParsedComponent, PropertyInfo, View } from "./types.ts" */

/** @typedef {{ owner: string | null, abs?: string, view?: View }} Entry */

/**
 * @param {string} prefix
 * @param {string} relFile
 */
const tagOf = (prefix, relFile) => `${prefix}-${relFile.replace(/\.(js|ts)$/, "").replace(/\//g, "-")}`;

/**
 * @param {{
 *   projectDir: string,
 *   maps: () => ComponentMap[],
 *   views: () => View[],
 *   listFiles: (absDir: string) => string[],
 *   readFile: (abs: string) => string | null,
 *   exists: (abs: string) => boolean,
 * }} deps
 * @returns {ComponentIndex & { clear(): void }}
 */
export function createComponentIndex({ projectDir, maps, views, listFiles, readFile, exists }) {
  /** @type {Map<string, Entry> | null} */
  let tagMap = null;
  /** @type {Map<string, string | null>} */
  const sourceCache = new Map();
  /** @type {Map<string, Set<string> | null>} */
  const propsCache = new Map();
  /** @type {Map<string, string[]>} */
  const mixinCache = new Map();

  const build = () => {
    if (tagMap) return tagMap;
    /** @type {Map<string, Entry>} */
    const map = (tagMap = new Map());
    for (const view of views()) if (view.tag && !map.has(view.tag)) map.set(view.tag, { view, owner: null });
    for (const { owner, dir, components } of maps())
      for (const [prefix, dirOrMap] of Object.entries(components))
        if (typeof dirOrMap === "string") {
          const folder = path.join(dir, dirOrMap);
          for (const abs of listFiles(folder)) {
            const tag = tagOf(prefix, toRel(folder, abs));
            if (!map.has(tag)) map.set(tag, { abs, owner });
          }
        } else if (dirOrMap && typeof dirOrMap === "object")
          for (const [name, file] of Object.entries(dirOrMap)) {
            const tag = `${prefix}-${name}`;
            if (typeof file !== "string" || map.has(tag)) continue;
            const base = path.join(dir, file.replace(/^\.?\//, ""));
            const abs = ["", ".js", ".ts"].map((ext) => base + ext).find(exists);
            if (abs) map.set(tag, { abs, owner });
          }
    return map;
  };

  /**
   * @param {Entry} entry
   * @param {string} tag
   * @returns {ParsedComponent | null}
   */
  const parsedOf = (entry, tag) => {
    if (!entry.abs) return null;
    const source = readFile(entry.abs);
    try {
      return source ? definitionOf(parseComponentSources(source, entry.abs), tag) : null;
    } catch {
      return null;
    }
  };

  return {
    has: (tag) => build().has(tag),
    ownerOf: (tag) => build().get(tag)?.owner ?? null,
    sourceOf: (tag) => {
      if (sourceCache.has(tag)) return /** @type {string | null} */ (sourceCache.get(tag));
      const entry = build().get(tag);
      const source = entry?.view ? entry.view.source : entry?.abs ? readFile(entry.abs) : null;
      sourceCache.set(tag, source);
      return source;
    },
    mixinSourcesOf: (tag) => {
      const cached = mixinCache.get(tag);
      if (cached) return cached;
      const entry = build().get(tag);
      /** @type {string[]} */
      const out = [];
      const file = entry?.view ? path.join(projectDir, entry.view.file) : entry?.abs ?? null;
      const mixins = entry?.view ? entry.view.mixins : entry ? parsedOf(entry, tag)?.mixins ?? [] : [];
      if (file)
        for (const { spec } of mixins) {
          if (!spec.startsWith(".")) continue;
          const source = readFile(path.resolve(path.dirname(file), spec));
          if (source) out.push(source);
        }
      mixinCache.set(tag, out);
      return out;
    },
    propsOf: (tag) => {
      if (propsCache.has(tag)) return /** @type {Set<string> | null} */ (propsCache.get(tag));
      const entry = build().get(tag);
      /** @type {PropertyInfo[] | null} */
      const names = entry?.view ? entry.view.propertyNames : entry ? parsedOf(entry, tag)?.propertyNames ?? null : null;
      const props = names ? new Set(names.map((p) => p.name)) : null;
      propsCache.set(tag, props);
      return props;
    },
    clear() {
      tagMap = null;
      sourceCache.clear();
      mixinCache.clear();
      propsCache.clear();
    },
  };
}
