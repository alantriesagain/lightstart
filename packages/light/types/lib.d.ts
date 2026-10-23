/**
 * @bootstrapp/light/types/lib.d.ts: the standard library's members that
 * answer `any`, answering `unknown` (or what they can answer) in light's own
 * typecheck, so that parsed JSON, a value an array test admits, a response
 * body, a prototype, a fresh object and a `Function` bound to a receiver are
 * narrowed where they are read. The interfaces merge with the lib's, and a
 * merged declaration's signatures are tried first. No module imports this
 * file, so a consumer's types are unchanged.
 */

interface JSON {
  parse(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown;
}

interface ArrayConstructor {
  isArray(arg: unknown): arg is unknown[];
}

interface Function {
  bind(this: Function, thisArg: unknown, ...argArray: unknown[]): unknown;
}

interface ObjectConstructor {
  getPrototypeOf(o: unknown): object | null;
  create(o: object | null): unknown;
}

interface Body {
  json(): Promise<unknown>;
}
