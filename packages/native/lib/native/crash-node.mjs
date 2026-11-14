/**
 * @file The crash calls on node, for a test of the member that names the native manifest: preloaded
 * with `node --import`, it defines the functions the FFI binds natively as no-ops, since node runs
 * no crash handler of this package's.
 */
globalThis.crash_install = () => 0;
globalThis.crash_note = () => {};
globalThis.crash_trigger = () => {};
