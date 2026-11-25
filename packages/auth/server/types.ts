/**
 * @file The shapes both halves share: the signed-in person as the page sees
 * them.
 */

/** The signed-in person: their own row, without anything private to the server. */
export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  admin: boolean;
  [field: string]: unknown;
}
