/**
 * @file A free loopback port a test can bind explicitly after the probe that found it closes: node
 * and scriptc native alike.
 */
import { createServer as createNetServer } from "node:net";

export const freePort = (): Promise<number> =>
  new Promise((resolve: (port: number) => void, reject: (error: Error) => void) => {
    const probe = createNetServer();
    probe.once("error", (error: Error) => reject(error));
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

export const isFree = (port: number): Promise<boolean> =>
  new Promise((resolve: (free: boolean) => void) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
