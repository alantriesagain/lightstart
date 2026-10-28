import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const big = "x".repeat(1 << 20);

const pause = (res: ServerResponse): Promise<void> =>
  new Promise<void>((resolve: () => void) => {
    const socket = res.socket;
    if (socket === null || !socket.writableNeedDrain) {
      resolve();
      return;
    }
    socket.once("drain", () => resolve());
    socket.once("close", () => resolve());
  });

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const head: string[] = ["content-type", "text/plain"];
  res.writeHead(200, head);
  res.once("close", () => {
    console.log("closed");
  });
  const send = async (): Promise<void> => {
    let waits = 0;
    for (let i = 0; i < 16; i++) {
      res.write(big);
      const socket = res.socket;
      if (socket !== null && socket.writableNeedDrain) waits++;
      await pause(res);
    }
    res.end();
    console.log(req.method + " sent 16 MiB, waited " + (waits > 0 ? "at least once" : "never"));
  };
  send();
});

server.listen(0, "127.0.0.1", () => {
  /* @ts-expect-error */
  const port: number = server.address().port;
  fetch("http://127.0.0.1:" + String(port) + "/").then(async (res: Response) => {
    const body = res.body;
    let size = 0;
    if (body !== null) {
      const reader = body.getReader();
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        await new Promise<void>((resolve: () => void) => {
          setTimeout(resolve, 1);
        });
      }
    }
    console.log("received " + String(size));
    server.close();
  });
});
