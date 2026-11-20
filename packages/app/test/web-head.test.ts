// node-only
/**
 * @file A prerendered page carries its own title, description, canonical link
 * and link-preview tags. A route's title and description may be functions of
 * its params, a view may patch the head with `pageHead`, and `defineApp({ title })`
 * makes the app's display title the suffix.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createBuildExtension } from "@lightstart/build";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import appBuild from "../cli/extend/build.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-js", import.meta.url));
const typed = fileURLToPath(new URL("./fixtures/web", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-head-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(typed, "node_modules"), join(project, "node_modules"), "dir");
  return project;
};

const buildOf = async (project: string): Promise<string> => {
  const api = createBuildExtension({ root: project, minify: false });
  await appBuild.setup(undefined as never, { prerender: true, renderer: "markup" } as never, api);
  const report = await build({ root: project, minify: false }, api);
  return report.dir;
};

const count = (page: string, tag: string): number => page.split(tag).length - 1;

const main = async (): Promise<void> => {
  const project = copy();
  try {
    writeFileSync(
      join(project, "src", "routes.js"),
      'export default {\n  "/": { name: "home", title: "Home", view: "app-home" },\n  "/about": { name: "about", title: "About", description: "About the fixture", view: "app-about" },\n  "/p/:slug": { name: "project", title: ({ slug }) => `Route ${slug}`, description: ({ slug }) => `About ${slug}`, view: "app-project", params: () => [{ slug: "alpha" }, { slug: "beta" }] },\n};\n',
    );
    const dir = await buildOf(project);

    const home = readFileSync(join(dir, "index.html"), "utf8");
    eq("the home page is titled with the app alone", /<title>Fixture Web<\/title>/.exec(home)?.[0] ?? "", "<title>Fixture Web</title>");
    ok("the home page has no canonical without a route title", home.includes('rel="canonical" href="https://fixture.example/"'));

    const about = readFileSync(join(dir, "about", "index.html"), "utf8");
    ok("the about page carries its own title", about.includes("<title>About · Fixture Web</title>"));
    eq("the about page counts one description tag", String(count(about, 'name="description"')), "1");
    ok("the about page carries its description", about.includes('name="description" content="About the fixture"'));
    ok("the about page has a canonical link", about.includes('rel="canonical" href="https://fixture.example/about"'));
    ok("og:type is a website", about.includes('property="og:type" content="website"'));
    ok("twitter:card is a summary without an image", about.includes('name="twitter:card" content="summary"'));
    ok("the about page has no og:image", !about.includes('property="og:image"'));

    for (const slug of ["alpha", "beta"]) {
      const page = readFileSync(join(dir, "p", slug, "index.html"), "utf8");
      ok(`the ${slug} page reads the title function of its params`, page.includes(`<title>Route ${slug} · Fixture Web</title>`));
      ok(`the ${slug} page reads the description function of its params`, page.includes(`name="description" content="About ${slug}"`));
      ok(`the ${slug} page has its canonical`, page.includes(`rel="canonical" href="https://fixture.example/p/${slug}"`));
      ok(`the ${slug} page has its og:url`, page.includes(`property="og:url" content="https://fixture.example/p/${slug}"`));
      ok(`the ${slug} page has its og:title`, page.includes(`property="og:title" content="Route ${slug} · Fixture Web"`));
      ok(`the ${slug} page has its og:description`, page.includes(`property="og:description" content="About ${slug}"`));
      ok(`the ${slug} page makes pageHead's image absolute`, page.includes('property="og:image" content="https://fixture.example/images/project.png"'));
      ok(`the ${slug} page has a large twitter card`, page.includes('name="twitter:card" content="summary_large_image"'));
      eq(`the ${slug} page counts one title`, String(count(page, "<title>")), "1");
      eq(`the ${slug} page counts one og:image`, String(count(page, 'property="og:image"')), "1");
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
