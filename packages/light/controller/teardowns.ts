/**
 * @bootstrapp/light/controller/teardowns: what a controller lets go of when
 * it is disposed. `own` keeps an unsubscribe function, `drain` runs every one
 * kept, in the order they came, and forgets them; one that throws is logged
 * under the controller's name and the rest still run. Both forms of a
 * controller, the definition and the class, keep theirs here.
 */
export class Teardowns {
  private list: Array<() => void> = [];

  own(teardown: () => void): void {
    this.list.push(teardown);
  }

  drain(name: string): void {
    for (const teardown of this.list.splice(0))
      try {
        teardown();
      } catch (error) {
        console.error(`[controller] teardown failed in "${name}":`, error);
      }
  }
}
