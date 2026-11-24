// node-only
/**
 * @file The generation over the fixture app: a sorted static import per file,
 * relative from `.light`, the manifest names its folders give it, and a second
 * run that writes nothing.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { generate } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const components = fileURLToPath(new URL("../../components", import.meta.url));
const i18n = fileURLToPath(new URL("../../i18n", import.meta.url));

const copy = (): string => {
  const project = mkdtempSync(join(tmpdir(), "light-app-generate-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  const modules = join(project, "node_modules");
  mkdirSync(modules);
  mkdirSync(join(modules, "@lightstart"));
  symlinkSync(realpathSync(join(fixture, "node_modules", "@lightstart", "app")), join(modules, "@lightstart", "app"), "dir");
  return project;
};

/** A copy of the fixture whose project depends on `@lightstart/components`, linked from this checkout. */
const copyWithComponents = (): string => {
  const project = copy();
  const source = join(fixture, "node_modules", "@lightstart");
  const modules = join(project, "node_modules", "@lightstart");
  for (const sub of readdirSync(source)) {
    if (sub === "app" || sub === "components") continue;
    symlinkSync(realpathSync(join(source, sub)), join(modules, sub), "dir");
  }
  symlinkSync(components, join(modules, "components"), "dir");
  const iconify = join(project, "node_modules", "@iconify-json");
  mkdirSync(iconify);
  symlinkSync(realpathSync(fileURLToPath(new URL("../node_modules/@iconify-json/lucide", import.meta.url))), join(iconify, "lucide"), "dir");
  const manifest = readFileSync(join(project, "package.json"), "utf8");
  const pkg = JSON.parse(manifest) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), "@lightstart/components": "workspace:*" };
  writeFileSync(join(project, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  return project;
};

/** A copy of the components fixture that also depends on `@lightstart/i18n` and has words of its own. */
const copyWithI18n = (): string => {
  const project = copyWithComponents();
  const modules = join(project, "node_modules");
  symlinkSync(i18n, join(modules, "@lightstart", "i18n"), "dir");
  const manifest = readFileSync(join(project, "package.json"), "utf8");
  const pkg = JSON.parse(manifest) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), "@lightstart/i18n": "workspace:*" };
  writeFileSync(join(project, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  const locales = join(project, "src", "locales");
  mkdirSync(locales);
  writeFileSync(join(locales, "en.ts"), 'export default { greeting: "Hello" };\n');
  writeFileSync(join(locales, "pt.ts"), 'export default { greeting: "Olá" };\n');
  return project;
};

/** Add a dependency name to the project's package.json. */
const declareDependency = (project: string, name: string): void => {
  const path = join(project, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), [name]: "workspace:*" };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
};

/** A fake package under the project's node_modules, its package.json naming a one-tag table under `light.tags`. */
const addTagPackage = (project: string, name: string, tag: string, module: string): void => {
  const dir = join(project, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  const style = module.replace(/\.js$/, ".css");
  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name, version: "0.0.0", type: "module", light: { tags: "tags.json" } }, null, 2)}\n`);
  writeFileSync(join(dir, "tags.json"), `${JSON.stringify({ [tag]: { module, style, extends: null, uses: [], loads: [] } }, null, 2)}\n`);
  writeFileSync(join(dir, module), `import { defineComponent } from "@lightstart/light";\n\nexport default defineComponent({ tag: ${JSON.stringify(tag)} });\n`);
  writeFileSync(join(dir, style), `:where(${tag}) {}\n`);
  declareDependency(project, name);
};

const main = async (): Promise<void> => {
  const project = copy();
  try {
    const first = await generate(project);
    ok("the fixture has an app", first !== null);
    if (first === null) return done();

    ok("it finds the note model", first.models.join(",") === "note");
    eq("it finds the controllers", first.controllers.join(","), "notes,settings");
    eq("it sorts the views", first.views.join(","), "app-about,app-billing,app-fixed,app-form,app-home,app-item,app-legal,app-plain,app-profile,app-root,app-search,app-settings,app-shell-layout");
    ok("it finds the routes", first.routes);
    ok("the first run wrote", first.changed);

    const source = readFileSync(first.manifest, "utf8");
    ok("the model import is relative from .light", source.includes('import model0 from "../src/models/note.ts";'));
    ok("the controller import is relative from .light", source.includes('import controller0 from "../src/controllers/notes.ts";'));
    ok("the route import is relative from .light", source.includes('import routes from "../src/routes.ts";'));
    ok("a view import is relative and side-effect only", source.includes('import "../src/views/app-root.ts";'));
    ok("the model keeps its file name", source.includes('{ name: "note", model: model0 }'));
    ok("the controller keeps its file name", source.includes('{ name: "notes", controller: controller0 }'));
    ok("the views are named", source.includes('views: ["app-about", "app-billing", "app-fixed", "app-form", "app-home", "app-item", "app-legal", "app-plain", "app-profile", "app-root", "app-search", "app-settings", "app-shell-layout"]'));
    eq("the entry starts the web host with the default adapter", readFileSync(first.main, "utf8"), 'import { start } from "@lightstart/app/web";\nimport manifest from "./app.ts";\nimport { IndexedDBAdapterType } from "@lightstart/app/web/indexeddb.ts";\nimport { LocalStores } from "@lightstart/app/web/local.ts";\n\nawait start(manifest, {\n  adapters: [new IndexedDBAdapterType()],\n  stores: new LocalStores(),\n});\n');
    ok("a project without the components writes none", !existsSync(join(first.dir, "components.ts")) && !existsSync(join(first.dir, "components.css")));
    ok("a project without i18n writes no locales", !existsSync(join(first.dir, "locales.ts")) && !source.includes('import "./locales.ts";'));

    const syncPath = join(first.dir, "sync.ts");
    ok("a project declaring a sync gets .light/sync.ts", existsSync(syncPath));
    const sync = readFileSync(syncPath, "utf8");
    ok("a string-controller sync installs the view plugin", sync.includes("View.use(syncPlugin);"));
    ok("a string-controller sync registers no binder", !sync.includes("registerSyncBinder"));
    const syncAt = source.indexOf('import "./sync.ts";');
    ok("the manifest imports the sync", syncAt >= 0);
    ok("the sync import is before the views", syncAt < source.indexOf('import "../src/views/app-home.ts";'));
    ok("and before every model and controller, whose sync: is checked as it is defined", syncAt < source.indexOf("import model0") && syncAt < source.indexOf("import controller0"));

    const before = statSync(first.manifest).mtimeMs;
    const second = await generate(project);
    ok("a second run changes nothing", second !== null && !second.changed);
    eqn("and writes no file", statSync(first.manifest).mtimeMs, before);

    rmSync(join(project, ".light"), { recursive: true, force: true });
    const again = await generate(project);
    ok("the output is deterministic", again !== null && readFileSync(again.manifest, "utf8") === source);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const withComponents = copyWithComponents();
  try {
    const view = join(withComponents, "src", "views", "app-home.ts");
    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-card><lc-text>Home</lc-text></lc-card>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const first = await generate(withComponents);
    ok("the components app has an app", first !== null);
    if (first === null) return done();

    const module = readFileSync(join(first.dir, "components.ts"), "utf8");
    ok("the components module imports View", module.includes('import View from "@lightstart/light";'));
    ok("it imports the tag's module", module.includes('import lcCard from "@lightstart/components/layout/card.js";'));
    ok("it defines the base before the tag", module.indexOf("View.define(lcContainer);") < module.indexOf("View.define(lcCard);"));
    ok("it defines the used tag before the tag", module.indexOf("View.define(lcIcon);") < module.indexOf("View.define(lcCard);"));
    eq("the order is topological with ties by tag", module, 'import View from "@lightstart/light";\nimport lcContainer from "@lightstart/components/layout/container.js";\nimport lcIcon from "@lightstart/components/display/icon.js";\nimport lcCard from "@lightstart/components/layout/card.js";\nimport lcLabel from "@lightstart/components/form/label.js";\nimport lcForm from "@lightstart/components/form/form.js";\nimport lcText from "@lightstart/components/display/text.js";\nimport { configureOnDemand } from "@lightstart/components/utils/on-demand.js";\n\nView.define(lcContainer);\nView.define(lcIcon);\nView.define(lcCard);\nView.define(lcLabel);\nView.define(lcForm);\nView.define(lcText);\n\nconfigureOnDemand((tag) => {\n  if (tag === "lc-accordion") return import("@lightstart/components/navigation/accordion.js").then((module) => View.define(module.default));\n  if (tag === "lc-button") return import("@lightstart/components/display/button.js").then((module) => View.define(module.default));\n  if (tag === "lc-checkbox") return import("@lightstart/components/form/checkbox.js").then((module) => View.define(module.default));\n  if (tag === "lc-color-picker") return import("@lightstart/components/form/color-picker.js").then((module) => View.define(module.default));\n  if (tag === "lc-file-upload") return import("@lightstart/components/form/file-upload.js").then((module) => View.define(module.default));\n  if (tag === "lc-input") return import("@lightstart/components/form/input.js").then((module) => View.define(module.default));\n  if (tag === "lc-select") return import("@lightstart/components/form/select.js").then((module) => View.define(module.default));\n  if (tag === "lc-textarea") return import("@lightstart/components/form/textarea.js").then((module) => View.define(module.default));\n  if (tag === "lc-week-hours") return import("@lightstart/components/form/week-hours.js").then((module) => View.define(module.default));\n  return Promise.resolve();\n});\n');

    eq("the style module has the theme first, then each stylesheet", readFileSync(join(first.dir, "components.css"), "utf8"), '@import "../node_modules/@lightstart/light/theme/theme.css";\n@import "./icons.css";\n@import "../node_modules/@lightstart/components/navigation/accordion.css";\n@import "../node_modules/@lightstart/components/display/button.css";\n@import "../node_modules/@lightstart/components/layout/container.css";\n@import "../node_modules/@lightstart/components/display/icon.css";\n@import "../node_modules/@lightstart/components/layout/card.css";\n@import "../node_modules/@lightstart/components/form/color-picker.css";\n@import "../node_modules/@lightstart/components/form/file-upload.css";\n@import "../node_modules/@lightstart/components/form/label.css";\n@import "../node_modules/@lightstart/components/form/checkbox.css";\n@import "../node_modules/@lightstart/components/form/form.css";\n@import "../node_modules/@lightstart/components/form/input.css";\n@import "../node_modules/@lightstart/components/form/select.css";\n@import "../node_modules/@lightstart/components/display/text.css";\n@import "../node_modules/@lightstart/components/form/textarea.css";\n@import "../node_modules/@lightstart/components/form/week-hours.css";\n');

    const manifest = readFileSync(first.manifest, "utf8");
    const importAt = manifest.indexOf('import "./components.ts";');
    ok("app.ts imports the components", importAt >= 0);
    ok("the components import is before the views", importAt < manifest.indexOf('import "../src/views/app-home.ts";'));

    const second = await generate(withComponents);
    ok("a second components run changes nothing", second !== null && !second.changed);

    const form = join(withComponents, "src", "views", "app-form.ts");
    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-text>Home</lc-text>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    writeFileSync(form, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppForm extends View {\n  render() {\n    return html`<lc-text>Form</lc-text>`;\n  }\n}\n\nView.register("app-form", AppForm);\n');
    const plain = await generate(withComponents);
    ok("a components app that names no icon writes no icons.css", plain !== null && !existsSync(join(plain.dir, "icons.css")));

    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-icon name="house" solid size="18"></lc-icon><lc-button icon="menu"></lc-button><lc-clipboard></lc-clipboard>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const iconApp = await generate(withComponents);
    ok("an icon app generates", iconApp !== null);
    if (iconApp !== null) {
      ok("it writes icons.css", existsSync(join(iconApp.dir, "icons.css")));
      const icons = readFileSync(join(iconApp.dir, "icons.css"), "utf8");
      ok("the used name has a mask rule", icons.includes(':where(.lc-icon,lc-icon)[name="house"]{--lc-icon-mask:url("data:image/svg+xml,'));
      ok("the solid element has its own rule", icons.includes(':where(.lc-icon,lc-icon)[name="house"][solid]'));
      ok("the numeric size has its rule", icons.includes(':where(.lc-icon,lc-icon)[size="18"]{--lc-icon-size:18px}'));
      ok("an icon attribute is a name", icons.includes('[name="menu"]'));
      ok("a component's declared names are included", icons.includes('[name="copy"]') && icons.includes('[name="check"]'));
      ok("components.css imports the icons", readFileSync(join(iconApp.dir, "components.css"), "utf8").includes('@import "./icons.css";'));
    }

    const iconFolder = join(withComponents, "icons");
    mkdirSync(iconFolder, { recursive: true });
    writeFileSync(join(iconFolder, "brand-mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><!-- a mark --><path d="M1 1" /></svg>\n');
    writeFileSync(join(iconFolder, "house.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 2" /></svg>\n');
    const ownApp = await generate(withComponents);
    ok("an app icon app generates", ownApp !== null);
    if (ownApp !== null) {
      const own = readFileSync(join(ownApp.dir, "icons.css"), "utf8");
      ok("an app icon has a mask even when no source names it", own.includes('[name="brand-mark"]'));
      ok("the app icon wins over the set icon of the same name", own.includes("M2 2"));
    }

    rmSync(join(withComponents, "node_modules", "@iconify-json"), { recursive: true, force: true });
    const withoutSet = await generate(withComponents);
    ok("app icons generate with no set installed", withoutSet !== null && existsSync(join(withoutSet.dir, "icons.css")));
    if (withoutSet !== null) {
      const own = readFileSync(join(withoutSet.dir, "icons.css"), "utf8");
      ok("only the app's icons are written", own.includes('[name="brand-mark"]') && own.includes('[name="house"]') && !own.includes('[name="menu"]'));
    }

    rmSync(iconFolder, { recursive: true, force: true });

    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-form .fields=${[]}></lc-form>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const onDemandApp = await generate(withComponents);
    ok("a form app generates", onDemandApp !== null);
    if (onDemandApp !== null) {
      const formModule = readFileSync(join(onDemandApp.dir, "components.ts"), "utf8");
      ok("the form and its label import statically", formModule.includes('import lcForm from "@lightstart/components/form/form.js";') && formModule.includes('import lcLabel from "@lightstart/components/form/label.js";'));
      ok("it configures the on-demand definer", formModule.includes('import { configureOnDemand } from "@lightstart/components/utils/on-demand.js";'));
      ok("the controls are on demand", formModule.includes('if (tag === "lc-input") return import("@lightstart/components/form/input.js")') && formModule.includes('if (tag === "lc-checkbox") return import("@lightstart/components/form/checkbox.js")'));
      ok("the controls' styles are eager", readFileSync(join(onDemandApp.dir, "components.css"), "utf8").includes('@import "../node_modules/@lightstart/components/form/input.css";'));
    }

    writeFileSync(view, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<p>Home</p>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    writeFileSync(form, 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppForm extends View {\n  render() {\n    return html`<p>Form</p>`;\n  }\n}\n\nView.register("app-form", AppForm);\n');
    const cleared = await generate(withComponents);
    ok("a project with no tag removes the components files", cleared !== null && cleared.changed && !existsSync(join(cleared.dir, "components.ts")) && !existsSync(join(cleared.dir, "components.css")));
    ok("and removes the icons stylesheet", cleared !== null && !existsSync(join(cleared.dir, "icons.css")));
    ok("and app.ts no longer imports them", cleared !== null && !readFileSync(cleared.manifest, "utf8").includes('import "./components.ts";'));
  } finally {
    rmSync(withComponents, { recursive: true, force: true });
  }

  const withTags = copyWithComponents();
  try {
    addTagPackage(withTags, "@acme/camera", "cam-preview", "cam-preview.js");
    writeFileSync(join(withTags, "src", "views", "app-home.ts"), 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<lc-card><cam-preview></cam-preview></lc-card>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const first = await generate(withTags);
    ok("a project with a tags package has an app", first !== null);
    if (first === null) return done();

    const module = readFileSync(join(first.dir, "components.ts"), "utf8");
    ok("a component's module is imported from its package", module.includes('import lcCard from "@lightstart/components/layout/card.js";'));
    ok("the package's module is imported from its package", module.includes('import camPreview from "@acme/camera/cam-preview.js";'));
    ok("the package's tag is defined", module.includes("View.define(camPreview);"));

    const style = readFileSync(join(first.dir, "components.css"), "utf8");
    ok("a component's style is imported from its package", style.includes('@import "../node_modules/@lightstart/components/layout/card.css";'));
    ok("the package's style is imported from its package", style.includes('@import "../node_modules/@acme/camera/cam-preview.css";'));

    const second = await generate(withTags);
    ok("a second tags run changes nothing", second !== null && !second.changed);
  } finally {
    rmSync(withTags, { recursive: true, force: true });
  }

  const withClash = copyWithComponents();
  try {
    addTagPackage(withClash, "@acme/camera", "cam-preview", "cam-preview.js");
    addTagPackage(withClash, "@acme/maps", "cam-preview", "cam-preview.js");
    writeFileSync(join(withClash, "src", "views", "app-home.ts"), 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<cam-preview></cam-preview>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const message = await generate(withClash).then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("a tag two packages define fails naming the tag", message.includes("cam-preview"));
    ok("the collision names both packages", message.includes("@acme/camera") && message.includes("@acme/maps"));
  } finally {
    rmSync(withClash, { recursive: true, force: true });
  }

  const withI18n = copyWithI18n();
  try {
    const first = await generate(withI18n);
    ok("the i18n app has an app", first !== null);
    if (first === null) return done();

    const path = join(first.dir, "locales.ts");
    ok("a project on i18n gets .light/locales.ts", existsSync(path));
    const source = readFileSync(path, "utf8");
    ok("it configures i18n", source.includes('import { applyLanguage, configureI18n, onLanguageSet } from "@lightstart/i18n";'));
    ok("it follows route locales", source.includes("onRouteLocale((locale) => applyLanguage(locale));"));
    ok("it navigates when the language is set", source.includes("onLanguageSet((locale) => navigateLocale(locale));"));
    ok("it imports each package's language file", source.includes('import locale0 from "@lightstart/components/locales/en.js";'));
    ok("it imports the project's own words", source.includes('import locale3 from "../src/locales/en.ts";'));
    ok("the package's words come before the project's", source.indexOf('"@lightstart/components/locales/en.js"') < source.indexOf('"../src/locales/en.ts"'));
    ok("the project's key wins over the package's", source.includes("en: merge(merge({}, locale0), locale3),"));
    ok("a language only the package has is still there", source.includes("es: merge({}, locale1),"));
    ok("the locales are every language found", source.includes('locales: ["en", "es", "pt"],'));
    ok("the default is the app's locale", source.includes('defaultLocale: "en",'));

    const manifest = readFileSync(first.manifest, "utf8");
    const importAt = manifest.indexOf('import "./locales.ts";');
    ok("app.ts imports the locales", importAt >= 0);
    ok("the locales import is before the views", importAt < manifest.indexOf('import "../src/views/app-about.ts";'));

    const second = await generate(withI18n);
    ok("a second i18n run changes nothing", second !== null && !second.changed);

    writeFileSync(join(withI18n, "src", "locales", "pt-BR.ts"), 'export default { greeting: "Oi" };\n');
    const regional = await generate(withI18n);
    const regionalSource = regional === null ? "" : readFileSync(path, "utf8");
    ok("a regional language merges over its base language's words, the packages' then the project's", regionalSource.includes('"pt-BR": merge(merge(merge({}, locale2), locale5), locale4),'));
    ok("the base language keeps only its own", regionalSource.includes("pt: merge(merge({}, locale2), locale5),"));

    const manifestPath = join(withI18n, "package.json");
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as { dependencies?: Record<string, string> };
    if (pkg.dependencies !== undefined) delete pkg.dependencies["@lightstart/i18n"];
    writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`);
    const cleared = await generate(withI18n);
    ok("a project no longer on i18n removes the file", cleared !== null && cleared.changed && !existsSync(path));
    ok("and app.ts no longer imports it", cleared !== null && !readFileSync(cleared.manifest, "utf8").includes('import "./locales.ts";'));
  } finally {
    rmSync(withI18n, { recursive: true, force: true });
  }

  const withModelSync = copy();
  try {
    writeFileSync(
      join(withModelSync, "src", "views", "app-home.ts"),
      'import View from "@lightstart/light";\nimport T from "@lightstart/light/types";\nimport { html } from "@lightstart/light/html";\nimport note from "../models/note.ts";\n\nclass AppHome extends View {\n  static props = { rows: T.array({ sync: note, query: { order: "text" } }) };\n\n  render() {\n    return html`<p>Home</p>`;\n  }\n}\n\nView.register("app-home", AppHome);\n',
    );
    const first = await generate(withModelSync);
    ok("the model-sync app has an app", first !== null);
    if (first === null) return done();
    const path = join(first.dir, "sync.ts");
    const source = readFileSync(path, "utf8");
    ok("a model sync installs the view plugin", source.includes("View.use(syncPlugin);"));
    ok("a model sync registers the binder", source.includes('import { registerSyncBinder } from "@lightstart/light/controller";') && source.includes('import { modelBinder } from "@lightstart/light/model/binder";') && source.includes("registerSyncBinder(modelBinder);"));

    writeFileSync(join(withModelSync, "src", "views", "app-home.ts"), 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<p>Home</p>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const cleared = await generate(withModelSync);
    ok("a project with no sync removes the install file", cleared !== null && cleared.changed && !existsSync(path));
    ok("and app.ts no longer imports it", cleared !== null && !readFileSync(cleared.manifest, "utf8").includes('import "./sync.ts";'));

    addTagPackage(withModelSync, "@acme/link", "link-sheet", "link-sheet.js");
    writeFileSync(join(withModelSync, "node_modules", "@acme/link", "link-sheet.js"), 'import { defineComponent } from "@lightstart/light";\nimport T from "@lightstart/light/types";\nimport link from "./link.js";\n\nexport default defineComponent({ tag: "link-sheet", props: { status: T.string({ sync: link }) } });\n');
    writeFileSync(join(withModelSync, "src", "views", "app-home.ts"), 'import View from "@lightstart/light";\nimport { html } from "@lightstart/light/html";\n\nclass AppHome extends View {\n  render() {\n    return html`<link-sheet></link-sheet>`;\n  }\n}\n\nView.register("app-home", AppHome);\n');
    const packaged = await generate(withModelSync);
    ok("a used package tag whose module declares a sync installs the view plugin", packaged !== null && existsSync(path) && readFileSync(path, "utf8").includes("View.use(syncPlugin);"));
    ok("and its target registers no model binder", !readFileSync(path, "utf8").includes("registerSyncBinder"));
  } finally {
    rmSync(withModelSync, { recursive: true, force: true });
  }

  const jsApp = copy();
  try {
    writeFileSync(join(jsApp, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\n\nexport default defineApp({ name: "fixture-web", host: "web" });\n');
    rmSync(join(jsApp, "src", "app.ts"));
    const first = await generate(jsApp);
    ok("a JavaScript app gets .light/sync.js", first !== null && existsSync(join(first.dir, "sync.js")));
    ok("a JavaScript app does not get a TypeScript install", first !== null && !existsSync(join(first.dir, "sync.ts")));
  } finally {
    rmSync(jsApp, { recursive: true, force: true });
  }
  done();
};

await main();
