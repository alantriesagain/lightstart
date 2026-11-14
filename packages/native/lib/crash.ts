/**
 * @file The crash report: hands the run's log, the app's name and the terminal's state to the native
 * handler (native/crash.c), which writes what was running and where before the process dies by its
 * signal; `note` keeps the trail's last text for it, a bounded copy cheap enough for every key,
 * plugin call and frame. Under node the calls are the no-ops native/crash-node.mjs defines.
 */
declare function crash_install(log: string, app: string): number;
declare function crash_note(text: string): void;
declare function crash_trigger(kind: number): void;

/** Install the handlers, logging to `logPath` (empty: none) and naming `appName` on stderr. */
export function installCrash(logPath: string, appName: string): void {
  crash_install(logPath, appName);
}

/** Say what runs now, for a crash's report (at most 1 KB is kept). */
export function noteCrash(text: string): void {
  crash_note(text);
}

/** Crash on purpose: kind 0 writes through a null pointer, any other aborts (the selftest's trigger). */
export function triggerCrash(kind: number): void {
  crash_trigger(kind);
}
