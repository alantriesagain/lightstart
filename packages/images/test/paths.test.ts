/**
 * @file Variant paths: the suffix goes before the extension, an empty or
 * extension-less input answers "", and only a real `_suffix.ext` name is a
 * variant.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { isVariant, thumbUrl, variantUrl } from "../paths.js";

eq("inserts the suffix before the extension", variantUrl("/assets/place-images/foo.jpg", "thumb"), "/assets/place-images/foo_thumb.jpg");
eq("keeps the extension of another format", variantUrl("foo.webp", "og"), "foo_og.webp");

eq("answers empty for empty input", variantUrl("", "thumb"), "");
eq("answers empty for null", variantUrl(null, "thumb"), "");
eq("answers empty for an extension-less path", variantUrl("/assets/no-extension", "thumb"), "");
eq("answers empty for a dot in a directory name", variantUrl("/assets.dir/no-extension", "thumb"), "");

eq("thumbUrl is the thumb-suffix convention", thumbUrl("/a/b.jpg"), "/a/b_thumb.jpg");

ok("recognizes a variant name", isVariant("foo_thumb.jpg", "thumb"));
ok("refuses the source name", !isVariant("foo.jpg", "thumb"));
ok("refuses a name that only contains the suffix", !isVariant("thumbnail.jpg", "thumb"));

done();
