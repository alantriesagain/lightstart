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

const icon = (/** @type {string} */ dir, /** @type {string} */ name, /** @type {string} */ text) => {
  mkdirSync(join(dir, "icons"), { recursive: true });
  writeFileSync(join(dir, "icons", name), text);
  return { [`icons/${name}`]: text };
};

const clean = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0" /></svg>';

test("fires on a dynamic icon binding when the app names no icon anywhere", async () => {
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

test("stays silent when another module carries the icon literals", async () => {
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

test("a data field named icon alone is not icon use: no set is required and no name is unknown", async () => {
  const dir = project(null);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/seed.ts": 'export default { tile: [{ title: "Light", icon: "my-own-logo" }] };\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fires on an icon file whose name is not a valid icon name", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(rule, { ...icon(dir, "Bad.svg", clean) }, { projectDir: dir });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /icons\/Bad\.svg/);
    assert.match(findings[0].message, /kebab-case/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fires on each problem an icon file has", async () => {
  const dir = project(collection);
  try {
    const text = '<svg viewBox="0 0 24 24"><script>1</script><path fill="red" d="M0 0" /></svg>';
    const findings = await runRuleOn(rule, { ...icon(dir, "brand.svg", text) }, { projectDir: dir });
    assert.equal(findings.length, 2);
    assert.match(findings[0].message, /icons\/brand\.svg/);
    assert.match(findings[0].message, /<script>/);
    assert.match(findings[1].message, /colour/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an app icon with a set icon's name is reported as shadowing it", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(rule, { ...icon(dir, "house.svg", clean) }, { projectDir: dir });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "error");
    assert.match(findings[0].message, /"house"/);
    assert.match(findings[0].message, /shadows/);
    assert.match(findings[0].message, /"lucide"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a drawn name is known when the app's icons folder has it", async () => {
  const dir = project(collection);
  try {
    const findings = await runRuleOn(
      rule,
      { ...icon(dir, "brand.svg", clean), "src/views/app-home.ts": 'const view = `<lc-icon name="brand"></lc-icon>`;\n' },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing set is not reported when every drawn name is an app icon", async () => {
  const dir = project(null);
  try {
    const findings = await runRuleOn(
      rule,
      { ...icon(dir, "brand.svg", clean), "src/views/app-home.ts": 'const view = `<lc-icon name="brand"></lc-icon>`;\n' },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing set is still reported when a drawn name needs it", async () => {
  const dir = project(null);
  try {
    const findings = await runRuleOn(
      rule,
      { ...icon(dir, "brand.svg", clean), "src/views/app-home.ts": 'const view = `<lc-icon name="brand"></lc-icon><lc-icon name="house"></lc-icon>`;\n' },
      { projectDir: dir },
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /pnpm add -D @iconify-json\/lucide/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an app drawing only its own icons from data needs no set and reports nothing", async () => {
  const dir = project(null);
  try {
    mkdirSync(join(dir, "icons"));
    writeFileSync(join(dir, "icons", "zap.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0" /></svg>\n');
    const findings = await runRuleOn(
      rule,
      {
        "src/seed.ts": 'export default { tile: [{ icon: "zap" }] };\n',
        "src/views/app-home.ts": "const view = (row) => `<lc-icon name=${row.icon}></lc-icon>`;\n",
        "icons/zap.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0" /></svg>\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an app that loads its icons at run time needs no set, and its names and bindings are its loader's", async () => {
  const dir = project(null);
  try {
    const findings = await runRuleOn(
      rule,
      {
        "src/views/app-shell.ts": 'import { configureIcons, iconify } from "@lightstart/light/theme/icons.js";\nconfigureIcons({ load: iconify("tabler") });\nconst view = (name) => `<lc-icon name="anything"></lc-icon><lc-icon name=${name}></lc-icon>`;\n',
      },
      { projectDir: dir },
    );
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
