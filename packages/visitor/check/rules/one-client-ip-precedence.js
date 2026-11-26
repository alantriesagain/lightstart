import { defineRule } from "@lightstart/light/check/define.js";

const CF = /CF-Connecting-IP/i;
const XFF = /X-Forwarded-For/i;
const OWNER = "@lightstart/visitor";

export default defineRule({
  severity: "error",
  description: `the client-IP precedence lives once, in ${OWNER}; a second file naming CF-Connecting-IP alongside X-Forwarded-For is a copy of it`,
  why: "every copy of this precedence still answers an address, just not always the right one: one never split X-Forwarded-For on commas and keyed a rate limit on the whole proxy chain, and two read only the casing Caddy happened to send. A copy is silent when it goes wrong",
  check(ctx) {
    if (ctx.pkg.name === OWNER) return;
    const ignore = /** @type {string[]} */ (ctx.config.check?.ignore || []);

    for (const file of ctx.files()) {
      if (!/\.(js|mjs|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      if (file.includes("check/rules/")) continue;
      if (ignore.some((prefix) => file.startsWith(prefix))) continue;
      const source = ctx.code(file);
      if (!source || !CF.test(source) || !XFF.test(source)) continue;
      ctx.report({
        file,
        offset: source.search(CF),
        message: `this reads the forwarded headers itself; import clientIp from ${OWNER} instead`,
      });
    }
  },
});
