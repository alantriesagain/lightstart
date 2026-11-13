/**
 * @file The app shell: one merged importmap, and the reload client when watching.
 */
import { renderShell } from "../shell.ts";
import { done, eqn, ok } from "@light/test/assert.ts";

const raw = '<html><head><title>x</title><script type="importmap">{"imports":{"old":"/old.js"}}</script></head><body><p>hi</p></body></html>';
const out = renderShell(raw, { "@lightstart/light": "/light/index.js" }, { reload: true });

eqn("the old importmap is replaced by one", (out.match(/<script type="importmap">/g) ?? []).length, 1);
ok("the merged map is present", out.includes('"@lightstart/light":"/light/index.js"'));
ok("the old entry is gone", !out.includes('"old"'));
ok("the importmap goes in head", out.indexOf("importmap") < out.indexOf("</head>"));
ok("the reload client goes in body", out.includes('<script type="module" src="/__light/reload.js"></script>') && out.indexOf("reload.js") < out.indexOf("</body>"));

const plain = renderShell("<html><body>x</body></html>", {});
ok("no importmap when there is none to inject", !plain.includes('type="importmap"'));
ok("no reload client unless watching", !plain.includes("reload.js"));
ok("an html without a body keeps the reload tag", renderShell("<p>x</p>", {}, { reload: true }).endsWith('<script type="module" src="/__light/reload.js"></script>'));
done();
