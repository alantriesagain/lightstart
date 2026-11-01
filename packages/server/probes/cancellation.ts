/**
 * @file Probe: what scriptc lowers of cancellation. An `AbortController` made, aborted and
 * listened to; a `Promise.race` of a slow promise and a timer; `setTimeout` handles and
 * `clearTimeout`; a `Timeout` read through `typeof`. Node and native, same output or the exact
 * refusal.
 */
const delay = (ms: number, value: string): Promise<string> =>
  new Promise((resolve: (value: string) => void) => {
    setTimeout(() => resolve(value), ms);
  });

const timed = async (): Promise<void> => {
  const started = Date.now();
  const raced = await Promise.race([delay(200, "late"), delay(10, "early")]);
  console.log("race " + raced + " quick " + String(Date.now() - started < 150));
  const timer = setTimeout(() => {}, 10000);
  console.log("setTimeout handle " + typeof timer);
  clearTimeout(timer);
  console.log("cleared");
};

const aborted = async (): Promise<void> => {
  try {
    const controller = new AbortController();
    const signal = controller.signal;
    console.log("initial aborted " + String(signal.aborted) + " reason " + String(signal.reason === undefined ? "none" : "some"));
    let fired = 0;
    signal.addEventListener("abort", () => {
      fired++;
      console.log("abort event " + String(signal.aborted));
    });
    controller.abort();
    console.log("after abort " + String(signal.aborted) + " fired " + String(fired));
    if (signal.aborted) console.log("a work loop stops " + String(true));
  } catch (error) {
    console.log("AbortController refused: " + (error instanceof Error ? error.message : String(error)));
  }
};

const working = async (): Promise<void> => {
  const controller = new AbortController();
  let ticks = 0;
  const work = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      ticks++;
      await delay(2, "tick");
    }
  };
  const running = work();
  setTimeout(() => controller.abort(), 20);
  await running;
  console.log("work stopped by a timer " + String(controller.signal.aborted) + " ticks " + String(ticks > 0));
};

const main = async (): Promise<void> => {
  await aborted();
  await timed();
  await working();
};

main();

export {};
