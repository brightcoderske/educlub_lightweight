import { fetchWithRetry, NETWORK_ERROR_MESSAGE } from "lib/api";

const noWait = () => Promise.resolve();
const dropped = () => Promise.reject(new TypeError("Failed to fetch"));
const ok = { ok: true, status: 200 };

afterEach(() => {
  delete global.fetch;
});

it("a read that hits a dropped connection is tried again before anyone sees an error", async () => {
  global.fetch = jest.fn().mockImplementationOnce(dropped).mockResolvedValueOnce(ok);
  await expect(fetchWithRetry("/api/allocations", {}, [800, 2000], noWait)).resolves.toBe(ok);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it("when the connection stays down the learner is told so in plain words", async () => {
  global.fetch = jest.fn(dropped);
  await expect(fetchWithRetry("/api/allocations", {}, [800, 2000], noWait)).rejects.toMatchObject({
    message: NETWORK_ERROR_MESSAGE,
    network: true,
  });
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

it("a write is sent once, so a submission that did arrive is never doubled", async () => {
  global.fetch = jest.fn(dropped);
  await expect(
    fetchWithRetry("/api/courses/activities/4/submissions", { method: "POST" })
  ).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("a server that answers with an error is not retried; its answer is the result", async () => {
  const failed = { ok: false, status: 500 };
  global.fetch = jest.fn().mockResolvedValue(failed);
  await expect(fetchWithRetry("/api/allocations", {}, [800], noWait)).resolves.toBe(failed);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
