/**
 * @file The `moderationQueue` controller: what waits on the admin, read from
 * the admin endpoint, grouped under the headings `queueKinds` describes, and
 * the review moves (approve, reject, remove) made over the same bearer the
 * `api` store carries. Every call answers, and none throws: a failure is a
 * message the page draws.
 */

import { appUrl } from "@lightstart/app/base.ts";
import { authFetch, authPrefix, readToken } from "@lightstart/auth/page";
import { defineController } from "@lightstart/light/controller";

import { groupItems, submissionItem } from "./lib.ts";
import { queueKinds } from "./slots.ts";

import type { QueueGroup, QueueItem, QueueKind } from "../types.ts";

type Row = Record<string, unknown>;

interface Answer {
  ok: boolean;
  body: unknown;
  error: string;
}

interface ReviewAnswer {
  ok: boolean;
  message: string;
}

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const messageOf = (value: unknown): string => {
  if (!isRecord(value)) return "";
  const error = value["error"];
  if (typeof error === "string" && error !== "") return error;
  const message = value["message"];
  return typeof message === "string" ? message : "";
};

const urlOf = (path: string): string => `${appUrl("")}${authPrefix()}${path}`;

const send = async (method: string, path: string, body?: Row): Promise<Answer> => {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token !== null && token !== "") headers["authorization"] = `Bearer ${token}`;
  try {
    const response = await authFetch()(urlOf(path), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let value: unknown = null;
    try {
      value = await response.json();
    } catch {
      value = null;
    }
    if (!response.ok) return { ok: false, body: value, error: messageOf(value) || `The request failed (${String(response.status)})` };
    return { ok: true, body: value, error: "" };
  } catch (error) {
    return { ok: false, body: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const moderationQueue = defineController({
  name: "moderationQueue",
  props: {
    items: [] as QueueItem[],
    loading: false,
    message: "",
    busy: "",
  },

  connected() {
    return this.load();
  },

  /** The kinds `queueKinds` holds, by kind. */
  kinds(): Map<string, QueueKind> {
    return new Map(queueKinds.items.value.map((kind) => [kind.kind, kind]));
  },

  /** The waiting items under their headings. */
  groups(): QueueGroup[] {
    return groupItems(this.items, this.kinds());
  },

  /** Read the pending submissions from the admin endpoint. */
  async load(): Promise<void> {
    this.loading = true;
    try {
      const answer = await send("GET", "/api/moderation/pending");
      if (!answer.ok) {
        this.items = [];
        this.message = `The queue did not load: ${answer.error}`;
        return;
      }
      const rows = isRecord(answer.body) && Array.isArray(answer.body["rows"]) ? answer.body["rows"].filter(isRecord) : [];
      const kinds = this.kinds();
      this.items = rows.map((row) => submissionItem(row, kinds));
      this.message = "";
    } finally {
      this.loading = false;
    }
  },

  /** One waiting item, or null. */
  item(id: string): QueueItem | null {
    return this.items.find((entry) => entry.id === id) ?? null;
  },

  async _review(id: string, status: "approved" | "rejected", note?: string): Promise<ReviewAnswer> {
    this.busy = id;
    try {
      const body: Row = { status };
      if (note !== undefined && note !== "") body["note"] = note;
      const answer = await send("PATCH", `/api/moderation/submissions/${encodeURIComponent(id)}`, body);
      if (!answer.ok) {
        this.message = `That did not go through: ${answer.error}`;
        return { ok: false, message: this.message };
      }
      await this.load();
      this.message = status === "approved" ? "Approved." : "Rejected.";
      return { ok: true, message: this.message };
    } finally {
      this.busy = "";
    }
  },

  /** Approve one submission. */
  approve(id: string): Promise<ReviewAnswer> {
    return this._review(id, "approved");
  },

  /** Reject one submission, with an optional note for the review. */
  reject(id: string, note?: string): Promise<ReviewAnswer> {
    return this._review(id, "rejected", note);
  },

  /** Delete a submission, published or waiting. */
  async remove(id: string): Promise<ReviewAnswer> {
    this.busy = id;
    try {
      const answer = await send("DELETE", `/api/moderation/submissions/${encodeURIComponent(id)}`);
      if (!answer.ok) {
        this.message = `That did not go through: ${answer.error}`;
        return { ok: false, message: this.message };
      }
      await this.load();
      this.message = "Removed.";
      return { ok: true, message: this.message };
    } finally {
      this.busy = "";
    }
  },
});

export default moderationQueue;
export { moderationQueue };
