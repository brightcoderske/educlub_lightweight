// Work a page has not finished saving yet, so signing out can send it first.
// The learner editor registers a flusher while it is open; logout awaits every
// flusher, but never for longer than `timeoutMs`, so a dead connection cannot
// stop someone signing out.

const flushers = new Set();

export function registerPendingWork(flush) {
  flushers.add(flush);
  return () => flushers.delete(flush);
}

export async function flushPendingWork(timeoutMs = 3000) {
  if (!flushers.size) return;
  const all = Promise.allSettled([...flushers].map((flush) => flush()));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
