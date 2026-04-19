"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor() {
        this.buckets = new Map();
    }
    consume({ key, limit, windowMs, now = Date.now() }) {
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
    prune(now) {
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
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rateLimiter.js.map