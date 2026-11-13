export default (_ctx: unknown, payload: { log: string[] }): (() => void) => {
  payload.log.push("<project>");
  return () => {
    payload.log.push("teardown <project>");
  };
};
