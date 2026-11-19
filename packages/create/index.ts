/**
 * @file `@lightstart/create`: `light new` and the kind table behind it. The command is in
 * `./command`, the generator and its install modes in `./generate`.
 */
export { default as command } from "./command.ts";
export {
  copyTemplate,
  dependencyClosure,
  ensureTarget,
  findCheckout,
  generate,
  isCheckout,
  lightPackageDir,
  manifestFor,
  replaceTokens,
  resolveCheckout,
} from "./generate.ts";
export type { GenerateOptions, GeneratedManifest, InstallMode, PackageManager } from "./generate.ts";
export { KINDS, kindByName, titleOf } from "./kinds.ts";
export { appAt, generatePiece, isPiece, parseFields, PIECES } from "./pieces.ts";
export type { AppInfo, Field, FieldType, Piece, PieceOptions } from "./pieces.ts";
export type { Kind } from "./kinds.ts";
