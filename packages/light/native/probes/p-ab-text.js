/**
 * @file Probe AB: text and path helpers the host's search, replace, tree and path guard use. A
 * RegExp built from an escaped term with flags, replace with a string, test with lastIndex reset,
 * case folding, localeCompare in a sort, split, URI encoding, a fixed date's ISO form, parseInt,
 * padStart, Object.entries and fromEntries, and the path functions.
 */
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";

/** @param {string} s */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const term = "a.b";
const regex = new RegExp("\\b" + escapeRegex(term) + "\\b", "gi");
const line = "A.B and a.b and ab and xa.by";
regex.lastIndex = 0;
console.log("test", regex.test(line), regex.lastIndex > 0);
regex.lastIndex = 0;
console.log("replace", line.replace(regex, "Z"));
console.log("plain", new RegExp(escapeRegex("a.b"), "g").test("xa.by"), "a.b".toLowerCase().includes("a.b"));
const names = ["beta", "Alpha", "gamma", "alpha2"];
names.sort((/** @type {string} */ a, /** @type {string} */ b) => a.localeCompare(b));
console.log("sorted", names.join(","));
console.log("split", "one\ntwo\n".split("\n").length, "  x ".trim(), "7".padStart(3, "0"));
console.log("uri", encodeURIComponent("a b/ç?"), decodeURIComponent("a%20b%2F%C3%A7"));
console.log("date", new Date(0).toISOString(), Number.parseInt("42", 10), Number.isInteger(4.5), Math.floor(7.9));
const record = { b: 2, a: 1 };
const entries = Object.entries(record);
console.log("entries", entries.length, JSON.stringify(Object.fromEntries(entries.map(([k, v]) => [k + "!", v]))), Object.keys(record).join(","));
console.log("path", join("/a", "b", "../c"), normalize("/a//b/./c/"), resolve("/a", "b"), relative("/a/b", "/a/c/d"), extname("x.tar.gz"), basename("/p/q.txt"), dirname("/p/q.txt"), isAbsolute("p"));
const rel = relative("/root", "/root/../etc");
console.log("outside", rel.startsWith(".."), isAbsolute(rel));
