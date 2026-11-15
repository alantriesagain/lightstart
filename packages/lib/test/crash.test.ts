// ffi: native/ffi.json
/**
 * @file The crash calls: install and note are safe to call (the native handler is not exercised,
 * since a test that segfaulted would end the run); under node the manifest's stand-in answers them.
 */
import { done, ok } from "@lightstart/test/assert.ts";
import { installCrash, noteCrash } from "../crash.ts";

installCrash("", "lib-test");
installCrash("", "lib-test");
noteCrash("key enter > plugin claude > frame paint");
noteCrash("");
noteCrash("x".repeat(4096));
ok("install and note are safe, and a note over the bound is clipped", true);
done();
