/**
 * @bootstrapp/light/native/desktop: the desktop host as a TypeScript entry, so a
 * backend outside this checkout imports it by name and scriptc compiles it as
 * program source (a bare import that lands on a .js file is treated as an npm
 * package). The host itself stays JavaScript (host.js).
 */
export * from "./host.js";
