const pageCache = new Map();

export function getCachedPage(key) {
  return pageCache.get(key);
}

export function setCachedPage(key, value) {
  pageCache.set(key, {
    value,
    savedAt: Date.now(),
  });
  return value;
}

export function updateCachedPage(key, updater) {
  const current = getCachedPage(key)?.value;
  const next = updater(current);
  return setCachedPage(key, next);
}

export function clearCachedPage(key) {
  pageCache.delete(key);
}

export function clearPageCacheByPrefix(prefix) {
  [...pageCache.keys()].forEach((key) => {
    if (String(key).startsWith(prefix)) {
      pageCache.delete(key);
    }
  });
}
