// node-only
/**
 * @file `infoOf` reads the base the generator's static files use, from the app
 * config rather than from a view.
 */

import { fileURLToPath } from "node:url";
import { done, eq } from "@lightstart/test/assert.ts";
import { infoOf } from "../node/generate.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-base", import.meta.url));

const main = async (): Promise<void> => {
  const info = await infoOf(`${fixture}/src/app.js`);
  eq("infoOf answers the url's path", info.base, "/budget");
  eq("and keeps the address without a trailing slash", info.url ?? "", "https://user.github.io/budget");
  done();
};

await main();
