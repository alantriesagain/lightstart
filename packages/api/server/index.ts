/**
 * @file `@lightstart/api/server`: an app's server, its model CRUD routes with
 * schema permissions, and the endpoints it declares beside them, over one
 * D1-shaped database.
 */

export { serverApp, type DatabaseSource, type ServerOptions } from "./app.ts";
export { crudApp, type CrudOptions } from "./crud.ts";
export { bodyOfRequest, defineEndpoint, parameterNames, type Endpoint, type EndpointAccess, type EndpointDefinition, type EndpointHandler, type EndpointMethod, type EndpointRequest } from "./endpoint.ts";
export { check, permissionFor, publicFields, readPermissions, type Caller, type Operation, type PermissionCheck, type PermissionLevel, type Permissions } from "./permissions.ts";
export type { D1Like, D1MetaLike, D1Result, D1StatementLike } from "./d1.ts";
