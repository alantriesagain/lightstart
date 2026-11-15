/**
 * @file The command `--open` builds for each platform; the platform is passed in so no browser is
 * started here.
 */
import { browserCommand } from "../node/browser.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

eq("macOS opens with open", String(browserCommand("darwin", "http://localhost:3000")), 'open "http://localhost:3000"');
eq("Windows starts the default handler", String(browserCommand("win32", "http://localhost:3000")), 'start "" "http://localhost:3000"');
eq("Linux opens with xdg-open", String(browserCommand("linux", "http://localhost:3000")), 'xdg-open "http://localhost:3000"');
ok("an unknown platform has no command", browserCommand("aix", "http://localhost:3000") === null);
done();
