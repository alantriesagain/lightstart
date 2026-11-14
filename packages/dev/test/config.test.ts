/**
 * @file The port rules: the flag, then `light.dev.port`, then `PORT`, then 3000.
 */
import { DEFAULT_PORT, portOf, resolvePort } from "../config.ts";
import { done, eqn, ok } from "@light/test/assert.ts";

eqn("the flag wins", resolvePort({ argsPort: 4100, pkgPort: 4200, env: { PORT: "4300" } }), 4100);
eqn("the project's port next", resolvePort({ argsPort: undefined, pkgPort: 4200, env: { PORT: "4300" } }), 4200);
eqn("then PORT", resolvePort({ env: { PORT: "4300" } }), 4300);
eqn("then an extension's default", resolvePort({ fallback: 1315 }), 1315);
eqn("which PORT still wins", resolvePort({ env: { PORT: "4300" }, fallback: 1315 }), 4300);
eqn("then the default", resolvePort(), DEFAULT_PORT);
eqn("a flag string is read", resolvePort({ argsPort: "4100" }), 4100);
eqn("an invalid flag falls through", resolvePort({ argsPort: "nope", pkgPort: 4200 }), 4200);
eqn("PORT 0 is a port, not a fallback", resolvePort({ env: { PORT: "0" } }), 0);
eqn("portOf reads a number", portOf(3000) ?? -1, 3000);
ok("portOf refuses nonsense", portOf("nope") === null && portOf(-1) === null && portOf(70000) === null);
done();
