interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume({ key, limit, windowMs, now = Date.now() }: RateLimitOptions): RateLimitResult {
    if (limit <= 0 || windowMs <= 0) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      this.prune(now);
      return { allowed: true, retryAfterMs: 0 };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterMs: Math.max(1, current.resetAt - now),
      };
    }

    current.count += 1;
    this.prune(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private prune(now: number): void {
    if (this.buckets.size < 500) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
