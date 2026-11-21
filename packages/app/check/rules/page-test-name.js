import { defineRule } from "@lightstart/light/check/define.js";

const TEST_FILE = /^tests?\/.*\.test\.(?:js|ts)$/;
const BROWSER_TEST = /\.browser\.test\.(?:js|ts)$/;
const PAGE_TEST = "@lightstart/app/web/test";

export default defineRule({
  severity: "error",
  description: "a test that opens a page is named *.browser.test.*",
  why: "a plain *.test.* file runs under node with no DOM, so a test importing @lightstart/app/web/test fails there; the browser runner is what gives it a page, and the name is how light test knows to send it there",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!TEST_FILE.test(file) || BROWSER_TEST.test(file)) continue;
      const page = ctx.imports(file).find((item) => item.spec === PAGE_TEST);
      if (!page) continue;
      ctx.report({
        file,
        offset: page.offset,
        message: `${file} opens a page (@lightstart/app/web/test), so it runs in Chromium only when named *.browser.test.*`,
      });
    }
  },
});
