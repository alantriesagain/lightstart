import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runRuleOn } from "@lightstart/light/check/test-utils.js";
import rule from "./icons-known.js";

const collection = { prefix: "lucide", width: 24, height: 24, icons: { house: { body: '<path d="M0 0"/>' } }, aliases: {} };

const project = (/** @type {unknown} */ icons) => {
  const dir = mkdtempSync(join(tmpdir(), "light-icons-known-"));
  if (icons !== null) {
    mkdirSync(join(dir, "node_modules", "@iconify-json", "lucide"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "@iconify-json", "lucide", "icons.json"), JSON.stringify(icons));
  }
  return dir;
};

test("fires on a dynamic icon binding whose module declares no names", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-home.ts": 'const name = "house";\nconst view = `<lc-icon name=${name}></lc-icon>`;\n',
      },
      { projectDir: dir },
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /icons: \[\.\.\.\]/);
    assert.equal(findings[0].line, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stays silent when the module declares the dynamic names", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-home.ts": 'const name = "house";\nexport default { icons: ["house"], render: () => `<lc-icon name=${name}></lc-icon>` };\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stays silent when the module binding the name carries icon literals itself", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-root.ts": 'const NAV = [{ path: "/", icon: "house" }];\nconst view = NAV.map((item) => `<lc-link icon=${item.icon}></lc-link>`);\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stays silent when a module it imports carries the icon literals", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/lib/categories.ts": 'export const CATEGORIES = [{ id: "home", icon: "house" }];\nexport const iconOf = (id) => CATEGORIES.find((c) => c.id === id)?.icon;\n',
        "src/views/app-list.ts": 'import { iconOf } from "../lib/categories.ts";\nconst view = (row) => `<lc-icon name=${iconOf(row.category)}></lc-icon>`;\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fires on a literal name the set does not have", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-home.ts": 'const view = `<lc-icon name="nope"></lc-icon>`;\n',
      },
      { projectDir: dir },
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /"nope"/);
    assert.match(findings[0].message, /"lucide"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fires once when the project uses icons and the collection is not installed", async () => {
  const dir = project(null);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-home.ts": 'const view = `<lc-icon name="house"></lc-icon>`;\n',
        "src/views/app-about.ts": 'const view = `<lc-icon name="house"></lc-icon>`;\n',
      },
      { projectDir: dir },
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /pnpm add -D @iconify-json\/lucide/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
