/**
 * @lightstart/light/html/part: what a template instance holds for each
 * binding. The engine calls `setFromValues` on every update, `adopt` when it
 * takes over prerendered content and `dispose` when the instance goes. Every
 * part class extends this, so a native build dispatches the three calls
 * virtually; a part that adopts nothing commits its values.
 */
export class Part {
  setFromValues(_values           )       {}

  adopt(values           , _bind         )       {
    this.setFromValues(values);
  }

  dispose()       {}
}
