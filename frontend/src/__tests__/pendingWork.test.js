import { flushPendingWork, registerPendingWork } from "lib/pendingWork";

it("signing out waits for unsaved work to be sent", async () => {
  const sent = [];
  const unregister = registerPendingWork(
    () => new Promise((resolve) => setTimeout(() => resolve(sent.push("draft")), 20))
  );
  await flushPendingWork();
  expect(sent).toEqual(["draft"]);
  unregister();
});

it("a dead connection cannot stop someone signing out", async () => {
  const unregister = registerPendingWork(() => new Promise(() => {}));
  const started = Date.now();
  await flushPendingWork(50);
  expect(Date.now() - started).toBeLessThan(1000);
  unregister();
});

it("an editor that has closed is no longer flushed", async () => {
  const flush = jest.fn();
  registerPendingWork(flush)();
  await flushPendingWork();
  expect(flush).not.toHaveBeenCalled();
});
