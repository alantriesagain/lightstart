/**
 * Probe T's FFI edge: signature-only declarations bound to the stub library by p-t-ffi.ffi.json.
 * A `declare` has no JSDoc form, so this file is TypeScript; the probe imports it.
 */
export declare function stub_create(debug: number): bigint;
export declare function stub_set_title(w: bigint, text: string): void;
export declare function stub_title_len(w: bigint): number;
export declare function stub_bind(w: bigint, name: string, fn: (id: string, req: string) => void): number;
export declare function stub_unbind(w: bigint, name: string, fn: (id: string, req: string) => void): void;
export declare function stub_bound(w: bigint): number;
export declare function stub_pump(w: bigint): number;
export declare function stub_fired(w: bigint): number;
export declare function stub_return(w: bigint, id: string, status: number, json: string): void;
export declare function stub_replies(w: bigint): number;
export declare function stub_reply_status(w: bigint, i: number): number;
export declare function stub_reply_is(w: bigint, i: number, id: string, json: string): boolean;
export declare function stub_destroy(w: bigint): void;
