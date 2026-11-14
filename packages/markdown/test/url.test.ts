/**
 * @file What a link target may use: a scheme hidden behind a character reference or control
 * character is rejected, and http, https, mailto and relative targets are kept.
 */
import { remoteUrl, safeUrl } from "../index.ts";
import { done, ok } from "@light/test/assert.ts";

const rejected = [
  "java&#x09;script:alert(1)",
  "javascript&colon;alert(1)",
  "java&Tab;script:alert(1)",
  "JaVaScRiPt:alert(1)",
  " javascript:alert(1)",
  "vbscript:x",
  "data:text/html,<script>alert(1)</script>",
];

for (const href of rejected) ok(`rejects ${href}`, !safeUrl(href));

const allowed = [
  "https://example.com",
  "http://example.com/x",
  "/docs",
  "#intro",
  "mailto:a@b.c",
  "page.html?a=b:c",
  "//host/x",
];

for (const href of allowed) ok(`keeps ${href}`, safeUrl(href));

for (const href of ["https://x.test/p.png", "HTTP://x.test/p.png", "//x.test/p.png", " https://x.test", "https&colon;//x.test"]) ok(`${href} is remote`, remoteUrl(href));
for (const href of ["/img/p.png", "p.png", "./p.png", "#a", "page?u=https://x.test"]) ok(`${href} is not remote`, !remoteUrl(href));

done();
