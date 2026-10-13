/**
 * @bootstrapp/light/native/desktop/ffi: the shell's edge into the C shim. Signature-only
 * declarations bound to the shim's symbols by the manifest build.js writes; a `declare` has no
 * JSDoc form, so this one file is TypeScript. Strings cross as UTF-8 spans, the window handle as
 * a bigint, and a bound callback is released by passing the same function value to the unbind.
 */
export declare function desktop_create(debug: number, flags: number): bigint;
export declare function desktop_window(w: bigint): bigint;
export declare function desktop_set_title(w: bigint, title: string): void;
export declare function desktop_set_size(w: bigint, width: number, height: number, hint: number): void;
export declare function desktop_navigate(w: bigint, url: string): void;
export declare function desktop_set_html(w: bigint, html: string): void;
export declare function desktop_init(w: bigint, js: string): void;
export declare function desktop_eval(w: bigint, js: string): void;
export declare function desktop_bind(w: bigint, name: string, fn: (id: string, req: string) => void): number;
export declare function desktop_unbind(w: bigint, name: string, fn: (id: string, req: string) => void): void;
export declare function desktop_return(w: bigint, id: string, status: number, json: string): void;
export declare function desktop_pump(w: bigint): number;
export declare function desktop_terminate(w: bigint): void;
export declare function desktop_destroy(w: bigint): void;
export declare function desktop_minimize(w: bigint): void;
export declare function desktop_maximize(w: bigint, on: number): void;
export declare function desktop_is_maximized(w: bigint): number;
export declare function desktop_inspector(w: bigint): void;
export declare function desktop_begin_move(w: bigint): void;
export declare function desktop_close(w: bigint): void;
export declare function desktop_window_state(w: bigint): number;
export declare function desktop_message(w: bigint, title: string, text: string): void;
export declare function desktop_dialog_bind(w: bigint, fn: (id: number, status: number, paths: string) => void): number;
export declare function desktop_dialog_unbind(w: bigint, fn: (id: number, status: number, paths: string) => void): void;
export declare function desktop_dialog_open(w: bigint, kind: number, title: string, path: string, multi: number): number;
export declare function desktop_dialog_cancel(w: bigint, id: number): void;
