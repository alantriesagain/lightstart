/**
 * @file What a link target may use: a scheme hidden behind a character reference or control
 * character is rejected, and http, https, mailto and relative targets are kept.
 */
import { safeUrl } from "../index.ts";
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

done();
