/**
 * @file The hooks `light serve` dispatches, added to `@lightstart/cli`'s `Hooks` by declaration
 * merging: before listening, after listening, and on every watched file change.
 */
import type { CommandContext } from "@lightstart/cli";
import type { ServeExtension } from "./extension.ts";

/** The URLs the server answers on, as a hook sees them. */
export type ServeOrigins = {
  local: string;
  lan?: string;
};

/** What `serve:before` receives: the project, the port it will try, and whether it watches. */
export interface ServeBeforePayload {
  projectDir: string;
  port: number;
  watch: boolean;
}

/** What `serve:after` receives once the server is listening; its teardown runs at shutdown. */
export interface ServeAfterPayload extends ServeBeforePayload {
  origins: ServeOrigins;
}

/** What a watched change looks like: its project-relative path and what the filesystem reported. */
export interface ServeFileChangedPayload {
  path: string;
  type: "change" | "rename";
}

declare module "@lightstart/cli" {
  interface Hooks {
    "serve:before": (ctx: CommandContext, payload: ServeBeforePayload) => void;
    "serve:after": (ctx: CommandContext, payload: ServeAfterPayload) => Promise<void> | void;
    "serve:file-changed": (ctx: CommandContext, payload: ServeFileChangedPayload) => void;
  }

  interface Extensions {
    serve: ServeExtension;
  }

  interface CommandArgs {
    serve: {
      dir: string | undefined;
      port: string | undefined;
      host: string;
      watch: boolean;
      build: boolean;
    };
  }
}
