/**
 * @file The windowed list: light's `LineView` (native/tui/line-view.ts) in the palette's colors, the scrollbar's
 * track, thumb and held thumb. The lines, the press and copy events and the row template are
 * light's, re-exported here for the views.
 */
import { LineView as LightLineView } from "@bootstrapp/light/native/tui";
import { palette } from "./palette.ts";

export { Line, LineSource, Run } from "@bootstrapp/light/native/tui/lines.ts";
export { LineCopy, LinePress, lineTemplate } from "@bootstrapp/light/native/tui";

export class LineView extends LightLineView {
  constructor() {
    super();
    this.trackFg = palette.track;
    this.thumbFg = palette.thumb;
    this.heldFg = palette.held;
  }
}
