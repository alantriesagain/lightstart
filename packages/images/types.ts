/**
 * @file The shapes image code shares: a resize operation, a configured
 * sibling variant, the merged config, and what a resizer answers.
 */

/** One resize the engine performs: the box to fit, how to fit it, and the encoding. */
export interface ResizeOp {
  width: number;
  height?: number;
  fit?: "max" | "cover";
  quality?: number;
  type?: string;
}

/** A configured sibling variant: a resize written next to the source as `<name>_<suffix>.<ext>`. */
export interface ImageVariant extends ResizeOp {
  suffix: string;
}

/** The `light.images` config after merging over `DEFAULTS`. */
export interface ImagesConfig {
  dirs: string[];
  maxPx: number;
  maxBytes: number;
  quality: number;
  variants: ImageVariant[];
}

/** One encoded image a resizer answers. */
export interface ResizeResult {
  bytes: Buffer;
  size: number;
  width: number;
  height: number;
}

/** A booted resize engine: many calls, then `close()`. */
export interface Resizer {
  resize(bytes: Uint8Array, ops: ResizeOp[]): Promise<ResizeResult[]>;
  close(): Promise<void>;
}
