#!/usr/bin/env node
import { readFileSync } from "node:fs";
import newCommand from "@lightstart/create/command";
import { createCli } from "../index.ts";
import { discover } from "../node/index.ts";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const cli = createCli({
  name: "light",
  version,
  scopes: ["@lightstart"],
  envPrefix: "LIGHT",
  commands: { new: newCommand },
  discover,
});

process.exitCode = await cli.main(process.argv.slice(2));
