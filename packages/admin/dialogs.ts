/**
 * @file The dialogs a tool asks for: a toast, a confirmation, a prompt, and the
 * notifications the header's bell lists. The shell draws the confirmation and
 * the prompt from `activeDialog`; `toasts` is `@lightstart/components`' queue.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";
import { toasts } from "@lightstart/components/feedback/toasts.js";
import { addNotification } from "./state.ts";
import type { AdminNotificationKind } from "./state.ts";

/** The kind of a toast or a notification. */
export type DialogKind = "info" | "warning" | "error";

/** A confirmation waiting on the shell. */
export interface ConfirmDialog {
  kind: "confirm";
  text: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (confirmed: boolean) => void;
}

/** A prompt waiting on the shell. */
export interface PromptDialog {
  kind: "prompt";
  text: string;
  value: string;
  placeholder: string;
  resolve: (answer: string | null) => void;
}

/** The confirmation or prompt the shell draws now, if any. */
export type ActiveDialog = ConfirmDialog | PromptDialog;

/** What the shell draws; null when nothing asks. */
export const activeDialog: Signal<ActiveDialog | null> = signal<ActiveDialog | null>(null);

/** Show `text` as a toast. */
export const message = (text: string, options: { kind?: DialogKind } = {}): void => {
  const variant = options.kind === "warning" ? "warning" : options.kind === "error" ? "error" : "info";
  toasts.show({ message: text, variant });
};

/** Ask for a yes or no, drawn by the admin shell. */
export const confirm = (text: string, options: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> => {
  const previous = activeDialog.value;
  if (previous !== null) settle(false);
  return new Promise<boolean>((resolve) => {
    activeDialog.value = { kind: "confirm", text, confirmLabel: options.confirmLabel ?? "Confirm", danger: options.danger === true, resolve };
  });
};

/** Ask for a line of text, drawn by the admin shell; null when cancelled. */
export const prompt = (text: string, options: { value?: string; placeholder?: string } = {}): Promise<string | null> => {
  const previous = activeDialog.value;
  if (previous !== null) settle(null);
  return new Promise<string | null>((resolve) => {
    activeDialog.value = { kind: "prompt", text, value: options.value ?? "", placeholder: options.placeholder ?? "", resolve };
  });
};

/** Add `entry` to the header's notification list. */
export const notify = (entry: { title: string; body?: string; kind?: AdminNotificationKind }): string => addNotification(entry);

/** Answer the open dialog and close it: a confirmation with `answer`, a prompt with `answer` or null. */
export const settle = (answer: boolean | string | null): void => {
  const dialog = activeDialog.value;
  if (dialog === null) return;
  activeDialog.value = null;
  if (dialog.kind === "confirm") dialog.resolve(typeof answer === "boolean" ? answer : false);
  else dialog.resolve(typeof answer === "string" ? answer : null);
};

/** Change the open prompt's text as its input changes. */
export const setPromptValue = (value: string): void => {
  const dialog = activeDialog.value;
  if (dialog === null || dialog.kind !== "prompt") return;
  activeDialog.value = { ...dialog, value };
};

/** What a tool calls for a toast, a confirmation, a prompt and a notification. */
export const dialogs = { message, confirm, prompt, notify, activeDialog, settle, setPromptValue };
