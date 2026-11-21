// node-only
/**
 * @file The sync scanner: a string-controller target, a model-bound target, a
 * mention in a comment, and a source with no sync.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { scanSync } from "../node/sync.ts";

const controller = scanSync('const props = { mode: T.string({ sync: "settings" }) };\n');
ok("a string target declares a sync", controller.sync);
ok("a string target needs no binder", !controller.binder);

const model = scanSync('import note from "../models/note.ts";\nconst props = { rows: T.array({ sync: note, query: { order: "text" } }) };\n');
ok("a model target declares a sync", model.sync);
ok("a model target needs the binder", model.binder);

const block = scanSync('import note from "../models/note.ts";\nexport default defineController({ name: "library", props: { rows: [] }, sync: { rows: { to: note, query: {} } } });\n');
ok("a controller block declares a sync", block.sync);
ok("a block target from the models needs the binder", block.binder);

const otherModel = scanSync('import * as Model from "../models/index.ts";\nconst props = { row: T.object({ sync: () => Model.session }) };\n');
ok("a thunk answering a model needs the binder", otherModel.binder);

const controllerTarget = scanSync('import note from "../models/note.ts";\nconst props = { mode: T.string({ sync: "settings" }), rows: T.array({ sync: note }) };\n');
ok("a source with both keeps the binder", controllerTarget.sync && controllerTarget.binder);

const comment = scanSync('import note from "../models/note.ts";\n// sync: note\n/* sync: "settings" */\nconst view = html`<p>Home</p>`;\n');
ok("a comment mentioning sync declares nothing", !comment.sync && !comment.binder);

const none = scanSync('import View from "@lightstart/light";\nconst props = { mode: T.string() };\n');
ok("a source with no sync declares none", !none.sync && !none.binder);

const importedButUnused = scanSync('import note from "../models/note.ts";\nconst props = { mode: T.string({ sync: "settings" }) };\n');
ok("a model imported for something else needs no binder", importedButUnused.sync && !importedButUnused.binder);

eq("scanning is stable", JSON.stringify(scanSync("const props = { sync: x };")), JSON.stringify({ sync: true, binder: false }));
done();
