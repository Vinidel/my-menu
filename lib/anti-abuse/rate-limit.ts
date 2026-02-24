type FixedWindowRateLimitConfig = {
  key: string;
  nowMs?: number;
  maxRequests: number;
  windowMs: number;
};

type FixedWindowBucket = {
  count: number;
  windowStartMs: number;
};

export type FixedWindowRateLimitResult =
  | { ok: true; remaining: number; resetAtMs: number }
  | { ok: false; retryAfterSeconds: number; resetAtMs: number };

declare global {
  // eslint-disable-next-line no-var
  var __my_menu_rate_limit_store__: Map<string, FixedWindowBucket> | undefined;
}

function getStore() {
  if (!globalThis.__my_menu_rate_limit_store__) {
    globalThis.__my_menu_rate_limit_store__ = new Map<string, FixedWindowBucket>();
  }

  return globalThis.__my_menu_rate_limit_store__;
}

export function consumeFixedWindowRateLimit(
  config: FixedWindowRateLimitConfig
): FixedWindowRateLimitResult {
  const nowMs = config.nowMs ?? Date.now();
  const store = getStore();
  const bucket = store.get(config.key);

  if (!bucket || nowMs >= bucket.windowStartMs + config.windowMs) {
    const nextBucket: FixedWindowBucket = {
      count: 1,
      windowStartMs: nowMs,
    };
    store.set(config.key, nextBucket);
    maybePruneStore(store, nowMs, config.windowMs);

    return {
      ok: true,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAtMs: nextBucket.windowStartMs + config.windowMs,
    };
  }

  if (bucket.count >= config.maxRequests) {
    const resetAtMs = bucket.windowStartMs + config.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));

    return {
      ok: false,
      retryAfterSeconds,
      resetAtMs,
    };
  }

  bucket.count += 1;
  store.set(config.key, bucket);

  return {
    ok: true,
    remaining: Math.max(0, config.maxRequests - bucket.count),
    resetAtMs: bucket.windowStartMs + config.windowMs,
  };
}

function maybePruneStore(
  store: Map<string, FixedWindowBucket>,
  nowMs: number,
  windowMs: number
) {
  if (store.size < 500) return;

  for (const [key, bucket] of Array.from(store.entries())) {
    if (nowMs >= bucket.windowStartMs + windowMs * 2) {
      store.delete(key);
    }
  }
}
