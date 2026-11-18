// node-only
/**
 * Every component has a demo, and every demo is shaped the way the showcase
 * reads it. The showcase has no other source: there is no scraper behind it and
 * no map beside it, so a missing demo is a blank page rather than a fallback.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, done, same, test } from "./check.ts";
import { codeOf } from "../lib/demos.ts";
import type { DemoExample } from "../lib/demos.ts";

interface Demo {
  description: string;
  examples: DemoExample[];
  preview: () => unknown;
  previewWidth?: number;
  slot?: () => unknown;
}

type DemoEntry = [string, Demo | null, string?];

const COMPONENTS = dirname(fileURLToPath(import.meta.resolve("@lightstart/components/package.json")));
const MANIFEST = ["boot", "strapp"].join("");
const manifest = JSON.parse(await readFile(join(COMPONENTS, "package.json"), "utf-8")) as Record<string, { components: { lc: Record<string, string> } }>;
const components = manifest[MANIFEST].components.lc;

const browsable = Object.entries(components);

const demos = await Promise.all(
  browsable.map(async ([name, path]): Promise<DemoEntry> => {
    const file = join(COMPONENTS, String(path).replace(/\.js$/, ".demo.js"));
    try {
      const module = (await import(file)) as { default: Demo };
      return [name, module.default];
    } catch (error) {
      return [name, null, error instanceof Error ? error.message : String(error)];
    }
  }),
);

test("every browsable component has a demo beside it", () => {
  const missing = demos.filter(([, demo]) => !demo).map(([name, , why]) => `${name} (${why})`);
  const none: string[] = [];
  same(missing, none, "a component without a demo shows a blank page in the showcase");
  assert.ok(demos.length > 100, `only ${demos.length} components were checked`);
});

test("a demo describes its component in a sentence", () => {
  for (const [name, demo] of demos) {
    if (!demo) continue;
    assert.equal(typeof demo.description, "string", `${name} has no description`);
    assert.ok(demo.description.length > 20, `${name}'s description says too little: ${demo.description}`);
    assert.ok(/[.!?]$/.test(demo.description), `${name}'s description is not a sentence`);
  }
});

test("every example has a title and renders from a function", () => {
  for (const [name, demo] of demos) {
    if (!demo) continue;
    assert.ok(Array.isArray(demo.examples) && demo.examples.length > 0, `${name} has no examples`);
    const titles = demo.examples.map((example) => example.title);
    assert.equal(new Set(titles).size, titles.length, `${name} repeats an example title`);
    for (const example of demo.examples) {
      assert.ok(example.title.length > 0, `${name} has an untitled example`);
      assert.equal(typeof example.render, "function", `${name}'s "${example.title}" has no render`);
      assert.equal(example.render.length, 0, `${name}'s "${example.title}" takes an argument`);
    }
  }
});

test("every demo carries a preview for the catalogue's card", () => {
  for (const [name, demo] of demos) {
    if (!demo) continue;
    assert.equal(typeof demo.preview, "function", `${name} has no preview`);
    assert.equal(demo.preview.length, 0, `${name}'s preview takes an argument`);
    if (demo.previewWidth !== undefined)
      assert.ok(Number.isFinite(demo.previewWidth) && demo.previewWidth > 200, `${name}'s previewWidth is not a width past the card's`);
  }
});

test("a slot, when there is one, is a function", () => {
  for (const [name, demo] of demos)
    if (demo && demo.slot !== undefined) assert.equal(typeof demo.slot, "function", `${name}'s slot is not a function`);
});

test("an example's code is read back off its own source", () => {
  const button = demos.find(([name]) => name === "button")?.[1];
  assert.ok(button !== undefined && button !== null, "button has a demo");
  if (!button) return;
  const example = button.examples[0];
  assert.ok(example !== undefined, "button has an example");
  if (!example) return;
  const code = codeOf(example);
  assert.match(code, /^<lc-button/);
  assert.ok(!code.includes("html`"), "the template tag leaked into the snippet");
  assert.ok(!/^\s/.test(code), "the snippet was not dedented");
});

done();
