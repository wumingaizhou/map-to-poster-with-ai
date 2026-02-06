type PosterPreviewObjectUrlEntry = {
  url: string;
  width: number;
  height: number;
  refCount: number;
  lastAccessMs: number;
  loading?: Promise<{ url: string }>;
};

export type PosterPreviewObjectUrlRef = {
  url: string;
  width: number;
  height: number;
  release: () => void;
};

const MAX_ENTRIES = 20;
const cache = new Map<string, PosterPreviewObjectUrlEntry>();

function touch(entry: PosterPreviewObjectUrlEntry): void {
  entry.lastAccessMs = Date.now();
}

function revokeAndDelete(versionId: string, entry: PosterPreviewObjectUrlEntry): void {
  cache.delete(versionId);
  URL.revokeObjectURL(entry.url);
}

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;

  while (cache.size > MAX_ENTRIES) {
    let lruKey: string | null = null;
    let lruEntry: PosterPreviewObjectUrlEntry | null = null;

    for (const [key, entry] of cache.entries()) {
      if (entry.refCount !== 0) continue;
      if (!lruEntry || entry.lastAccessMs < lruEntry.lastAccessMs) {
        lruKey = key;
        lruEntry = entry;
      }
    }

    if (!lruKey || !lruEntry) {
      return;
    }

    revokeAndDelete(lruKey, lruEntry);
  }
}

function release(versionId: string): void {
  const entry = cache.get(versionId);
  if (!entry) return;

  entry.refCount = Math.max(0, entry.refCount - 1);

  if (entry.refCount === 0) {
    evictIfNeeded();
  }
}

export async function acquirePosterPreviewObjectUrl(
  versionId: string,
  loader: () => Promise<Blob>
): Promise<PosterPreviewObjectUrlRef> {
  if (!versionId) {
    throw new Error("versionId is required");
  }

  const existing = cache.get(versionId);
  if (existing) {
    if (!existing.loading && !existing.url) {
      cache.delete(versionId);
    } else {
      existing.refCount += 1;
      touch(existing);

      if (existing.loading) {
        try {
          const resolved = await existing.loading;
          return {
            url: resolved.url,
            width: existing.width,
            height: existing.height,
            release: () => release(versionId)
          };
        } catch (error) {
          release(versionId);
          throw error;
        }
      }

      return {
        url: existing.url,
        width: existing.width,
        height: existing.height,
        release: () => release(versionId)
      };
    }
  }

  const entry: PosterPreviewObjectUrlEntry = {
    url: "",
    width: 0,
    height: 0,
    refCount: 1,
    lastAccessMs: Date.now()
  };

  entry.loading = (async () => {
    const blob = await loader();
    const url = URL.createObjectURL(blob);
    return { url };
  })();

  cache.set(versionId, entry);

  try {
    const resolved = await entry.loading;
    const current = cache.get(versionId);
    if (!current) {
      URL.revokeObjectURL(resolved.url);
      throw new Error("Object URL cache entry missing");
    }

    current.url = resolved.url;
    current.loading = undefined;
    touch(current);

    if (current.refCount === 0) {
      revokeAndDelete(versionId, current);
      throw new Error("Object URL released before load finished");
    }

    evictIfNeeded();

    return {
      url: current.url,
      width: current.width,
      height: current.height,
      release: () => release(versionId)
    };
  } catch (error) {
    const current = cache.get(versionId);

    if (current === entry) {
      cache.delete(versionId);
    }

    throw error;
  }
}

export function setPosterPreviewObjectUrlSize(versionId: string, size: { width: number; height: number }): void {
  if (!versionId) return;

  const entry = cache.get(versionId);
  if (!entry) return;

  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  entry.width = width;
  entry.height = height;
  touch(entry);
}

export function clearPosterPreviewObjectUrlCache(): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.refCount !== 0) continue;
    revokeAndDelete(key, entry);
  }
}
