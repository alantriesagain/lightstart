// node-only
/**
 * @file `light mobile:init` writes the shell from the fixture's config with no
 * template placeholders left, refuses to overwrite without `--force`, and
 * rewrites with it.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-init-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => path === fixture || (!path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed")),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const run = (project: string, args: string[]): { status: number; output: string } => {
  const result = spawnSync(process.execPath, ["--no-warnings", cli, ...args], {
    cwd: project,
    env: { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" },
    encoding: "utf8",
  });
  return { status: result.status ?? 1, output: `${result.stdout}${result.stderr}` };
};

const text = (project: string, path: string): string => readFileSync(join(project, "mobile", "android", path), "utf8");

const files = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
  const path = join(dir, entry);
  return statSync(path).isDirectory() ? files(path) : [path];
});

const main = (): void => {
  const project = copy();
  try {
    const first = run(project, ["mobile:init"]);
    eqn("mobile:init exits 0", first.status, 0);
    if (first.status !== 0) console.log(first.output);

    const gradle = text(project, "app/build.gradle");
    ok("the app id is the applicationId", gradle.includes("applicationId 'com.example.mobilefixture'"));
    ok("the namespace is the app id", gradle.includes("namespace 'com.example.mobilefixture'"));
    ok("the version name is kept", gradle.includes("versionName '1.0.0'"));
    ok("the version code is kept", gradle.includes("versionCode 1"));
    ok("minSdk is kept", gradle.includes("minSdk 26"));
    ok("the orientation is baked", gradle.includes('buildConfigField "String", "ORIENTATION", \'"portrait"\''));
    ok("the activity is the shell's own package", text(project, "app/src/main/AndroidManifest.xml").includes("android:name=\"dev.lightstart.mobile.MainActivity\""));
    ok("the app name reaches strings.xml", text(project, "app/src/main/res/values/strings.xml").includes(">Mobile Fixture<"));

    const leftovers = files(join(project, "mobile", "android"))
      .filter((path) => !path.endsWith(".jar"))
      .flatMap((path) => {
        const found = /__[A-Z_]+__/.exec(readFileSync(path, "utf8"));
        return found === null ? [] : [`${path}: ${found[0]}`];
      });
    eq("no template placeholders remain", leftovers.join(", "), "");
    ok("local.properties points at the SDK", existsSync(join(project, "mobile", "android", "local.properties")));

    const second = run(project, ["mobile:init"]);
    eqn("a second init refuses", second.status, 1);
    ok("the refusal names --force", second.output.includes("--force"));

    writeFileSync(join(project, "mobile", "android", "app", "src", "main", "res", "values", "strings.xml"), "<resources />\n");
    const forced = run(project, ["mobile:init", "--force"]);
    eqn("--force rewrites", forced.status, 0);
    ok("the forced init restores the app name", text(project, "app/src/main/res/values/strings.xml").includes(">Mobile Fixture<"));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

main();
