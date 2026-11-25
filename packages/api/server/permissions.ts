/**
 * @file A schema's `$permissions` as a decision. A missing permissions block
 * means `auth` for every operation, and a missing key means `auth` too; an
 * admin passes everything unscoped, an anonymous caller reads only what a
 * `public` block lists, and an `owner` operation is scoped to the caller's id
 * (and stamped on create).
 */

import type { ModelSchema } from "@lightstart/light/model/types.ts";

/** Who may do an operation: anyone, any caller, the row's owner, or nobody. */
export type PermissionLevel = "public" | "auth" | "owner" | "none";

/** The operations a permission block names. */
export type Operation = "read" | "create" | "write" | "delete";

/** A schema's `$permissions` block. */
export interface Permissions {
  read?: PermissionLevel;
  create?: PermissionLevel;
  write?: PermissionLevel;
  delete?: PermissionLevel;
  ownerField?: string;
  public?: string[];
}

/** Who makes a request: signed in with an id (an admin passing every check), or nobody. */
export type Caller = { id: string; admin?: boolean } | null;

/** What a check answers: allowed or not, the owner scope, the create stamp, and the readable fields. */
export interface PermissionCheck {
  allowed: boolean;
  scope: Record<string, unknown> | null;
  stamp: Record<string, unknown> | null;
  fields: string[] | null;
}

const DENIED: PermissionCheck = { allowed: false, scope: null, stamp: null, fields: null };

/** The `$permissions` block of `schema`, if it carries one. */
export const readPermissions = (schema: ModelSchema | undefined): Permissions | undefined => {
  if (schema === undefined) return undefined;
  const value = schema["$permissions"];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Permissions;
};

/** The level `permissions` gives `operation`, `auth` when it says nothing. */
export const permissionFor = (permissions: Permissions | undefined, operation: Operation): PermissionLevel => permissions?.[operation] ?? "auth";

/** The fields an anonymous reader of a `public` model may see (an empty list means none). */
export const publicFields = (permissions: Permissions | undefined): string[] => permissions?.public ?? [];

/**
 * Whether `caller` may do `operation` under `permissions`, plus the owner
 * `scope` to fold into a read or write, the `stamp` a create writes, and the
 * `fields` a public read is projected to.
 */
export const check = (permissions: Permissions | undefined, operation: Operation, caller: Caller): PermissionCheck => {
  const level = permissionFor(permissions, operation);
  if (caller !== null && caller.admin === true) return { allowed: true, scope: null, stamp: null, fields: null };
  if (level === "none") return DENIED;
  if (caller === null) {
    if (level !== "public") return DENIED;
    return { allowed: true, scope: null, stamp: null, fields: operation === "read" ? publicFields(permissions) : null };
  }
  if (level === "owner") {
    const ownerField = permissions?.ownerField ?? "owner";
    if (operation === "create") return { allowed: true, scope: null, stamp: { [ownerField]: caller.id }, fields: null };
    return { allowed: true, scope: { [ownerField]: caller.id }, stamp: null, fields: null };
  }
  return { allowed: true, scope: null, stamp: null, fields: null };
};
