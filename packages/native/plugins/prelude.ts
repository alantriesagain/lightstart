/**
 * @file The JS side of a plugin API, evaluated first in every context: the global an app's plugins call
 * (`<name>.plugin(def)`, `util`, `theme`), the table of plugin functions the core invokes by id
 * (`__invoke`, freed by registration through `__retire`), and `call`, a plugin's way into the core
 * (`__host`, its arguments and answer as JSON). The app brings its name, its theme as JSON and the
 * members of the api object its plugins get (`namespaces`: the text of the object's members, each a
 * namespace of calls built with `call`, `later`, `fn`, `once` and `opt`). Text the plugins draw
 * with is measured as the screen measures it: light's width tables are emitted here.
 *
 * The prelude keeps JSON as the bridge needs it, from a plugin that replaces the global. Each
 * plugin() call is a registration: the functions it made, so a reload of its file frees them. Every
 * call a plugin's api makes carries the registration, so the core can tell it from a direct __host
 * call and from another plugin's api. Text the plugins draw with is measured as the screen measures
 * it: the width tables are light's own (native/tui/width.ts), emitted here. A grapheme cluster is
 * as wide as its first code point with a width, two with an emoji presentation selector. QuickJS
 * has no Intl.Segmenter, so clusters are found here: combining marks, a zero-width joiner and what
 * it joins, a flag's two letters.
 */
import { WIDE, ZERO } from "@bootstrapp/light/native/tui/width.ts";

/** One part of the api object: a namespace (`name`) whose members are `source`, or, with "" as the name, members spliced in as they are. */
export class PreludePart {
  readonly name: string;
  readonly source: string;

  constructor(name: string, source: string) {
    this.name = name;
    this.source = source;
  }
}

/** The api's members from `parts`, each namespace frozen under its name. */
export const namespacesOf = (parts: PreludePart[]): string => {
  let out = "";
  for (const part of parts) out += part.name.length === 0 ? part.source : "      " + part.name + ": Object.freeze({\n" + part.source + "      }),\n";
  return out;
};

/** The prelude's source for global `globalName`, with `themeJson` as its theme and `namespaces` as the api's members. */
export const buildPrelude = (globalName: string, themeJson: string, namespaces: string): string =>
  `"use strict";
const __THEME = ` +
  themeJson +
  `;
(() => {
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const fns = [];
  const free = [];
  const release = (i) => {
    if (fns[i] !== undefined) {
      fns[i] = undefined;
      free.push(i);
    }
  };
  const fnRaw = (f) => {
    if (free.length > 0) {
      const i = free.pop();
      fns[i] = f;
      return i;
    }
    fns.push(f);
    return fns.length - 1;
  };
  const fn = fnRaw;
  let reg = 0;
  const owned = new Map();
  globalThis.__invoke = (id, json) => {
    const f = fns[id];
    if (typeof f !== "function") throw new Error(` + JSON.stringify(globalName + ": no plugin function ") + ` + id);
    const r = f(...parse(json));
    return r === undefined ? "null" : stringify(r);
  };
  globalThis.__retire = (r) => {
    for (const i of owned.get(r) ?? []) release(i);
    owned.delete(r);
  };
  const call = (name, ...args) => parse(__host(name, stringify(args)));
  let file = "";
  globalThis.__file = (f) => {
    file = f;
  };
  const api = (id, r) => {
    const list = owned.get(r) ?? [];
    owned.set(r, list);
    const fn = (f) => {
      const i = fnRaw(f);
      list.push(i);
      return i;
    };
    const once = (f) => {
      const i = fn((...args) => {
        release(i);
        return f(...args);
      });
      return i;
    };
    const later = (name, ...args) =>
      new Promise((resolve, reject) => {
        call(name, ...args, once((error, value) => (error !== null ? reject(new Error(error)) : resolve(value))));
      });
    const opt = (f, wrap) => (typeof f === "function" ? fn(wrap) : -1);
    const call = (name, ...args) => parse(__host(name, stringify(args.concat(["@r" + String(r)]))));
    return Object.freeze({
      id,
` +
  namespaces +
  `    });
  };
  const WIDE = [` +
  WIDE.join(", ") +
  `];
  const ZERO = [` +
  ZERO.join(", ") +
  `];
  const inRanges = (cp, t) => {
    let lo = 0;
    let hi = t.length / 2 - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cp < t[mid * 2]) hi = mid - 1;
      else if (cp > t[mid * 2 + 1]) lo = mid + 1;
      else return true;
    }
    return false;
  };
  const cpWidth = (cp) => (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) ? 0 : cp < 0x300 ? 1 : inRanges(cp, ZERO) ? 0 : inRanges(cp, WIDE) ? 2 : 1);
  const PLAIN = /^[\\x20-\\x7e]*$/;
  const clusters = (s) => {
    const out = [];
    let text = "";
    let cell = 0;
    let vs16 = false;
    let joined = false;
    let flag = false;
    const end = () => {
      if (text.length > 0) out.push([text, vs16 && cell === 1 ? 2 : cell]);
    };
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      const ri = cp >= 0x1f1e6 && cp <= 0x1f1ff;
      if (text.length > 0 && (joined || (cp >= 0x300 && inRanges(cp, ZERO)) || (flag && ri))) {
        if (ri) flag = false;
        text += ch;
      } else {
        end();
        text = ch;
        cell = 0;
        vs16 = false;
        flag = ri;
      }
      if (cp === 0xfe0f) vs16 = true;
      if (cell === 0) cell = cpWidth(cp);
      joined = cp === 0x200d;
    }
    end();
    return out;
  };
  const width = (s) => {
    s = String(s);
    if (PLAIN.test(s)) return s.length;
    let w = 0;
    for (const c of clusters(s)) w += c[1];
    return w;
  };
  const runsWidth = (runs) => runs.reduce((w, r) => w + width(r.text), 0);
  const clip = (s, cells) => {
    s = String(s);
    if (width(s) <= cells) return s;
    let out = "";
    let w = 0;
    for (const [text, cw] of clusters(s)) {
      if (w + cw > cells - 1) break;
      out += text;
      w += cw;
    }
    return out + "…";
  };
  const clipRuns = (runs, cells) => {
    const out = [];
    let left = cells;
    for (const r of runs) {
      const w = width(r.text);
      if (w <= left) {
        out.push(r);
        left -= w;
        continue;
      }
      if (left > 0) out.push({ ...r, text: clip(r.text, left) });
      break;
    }
    return out;
  };
  const pad = (runs, cells) => {
    const w = runsWidth(runs);
    if (w < cells) runs.push({ text: " ".repeat(cells - w), fg: "" });
    return runs;
  };
  const age = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h" + (m % 60) + "m";
    return Math.floor(h / 24) + "d";
  };
  const elapsed = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + "h" + m + "m";
    if (m > 0) return m + "m";
    return s + "s";
  };
  const tokens = (n) => {
    if (n < 1000) return String(n);
    if (n < 1000000) return Math.round(n / 1000) + "k";
    const m = n / 1000000;
    return (m >= 10 || Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1)) + "M";
  };
  const graphemes = (s) => clusters(String(s)).map((c) => c[0]);
  const util = Object.freeze({
    width,
    runsWidth,
    clip,
    clipRuns,
    pad,
    age,
    elapsed,
    tokens,
    graphemes,
    str: (v) => (typeof v === "string" ? v : ""),
    num: (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback),
    list: (v) => (Array.isArray(v) ? v : []),
    strs: (v) => (Array.isArray(v) ? v.map(String) : []),
    obj: (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : null),
    parse: (text) => {
      try {
        return parse(text);
      } catch {
        return null;
      }
    },
    quote: (text) => "'" + String(text).replace(/'/g, "'\\\\''") + "'",
    throttle: (f, ms) => {
      let last = 0;
      return (...args) => {
        const now = Date.now();
        if (now - last < ms) return;
        last = now;
        f(...args);
      };
    },
    wrap: (text, cells) => {
      const out = [];
      let line = "";
      for (const word of String(text).replace(/\\s+/g, " ").trim().split(" ")) {
        if (word.length === 0) continue;
        const next = line.length === 0 ? word : line + " " + word;
        if (width(next) <= cells) line = next;
        else {
          if (line.length > 0) out.push(line);
          line = width(word) <= cells ? word : clip(word, cells);
        }
      }
      if (line.length > 0) out.push(line);
      return out;
    },
  });
  const frames = Object.freeze(__THEME.frames);
  const theme = Object.freeze({ ...__THEME, marks: Object.freeze(__THEME.marks), frames, spinner: (now) => frames[Math.floor(now / __THEME.tick) % frames.length] });
  globalThis[` + JSON.stringify(globalName) + `] = Object.freeze({
    version: 1,
    util,
    theme,
    plugin(def) {
      if (def === null || typeof def !== "object" || typeof def.id !== "string" || typeof def.activate !== "function") throw new Error(` + JSON.stringify(globalName + ".plugin: a plugin needs an id and activate(api)") + `);
      const r = ++reg;
      const a = api(def.id, r);
      const list = owned.get(r);
      const requires = Array.isArray(def.requires) ? def.requires.map(String) : [];
      const defaults = typeof def.defaults === "function" ? def.defaults() : true;
      const activate = fn(() => { def.activate(a); });
      list.push(activate);
      const deactivate = typeof def.deactivate === "function" ? fn(() => { def.deactivate(); }) : -1;
      if (deactivate >= 0) list.push(deactivate);
      call("plugin", def.id, requires, defaults === undefined ? true : defaults, activate, deactivate, file, r);
    },
  });
})();
`;
