interface RateLimitOptions {
    key: string;
    limit: number;
    windowMs: number;
    now?: number;
}
export interface RateLimitResult {
    allowed: boolean;
    retryAfterMs: number;
}
export declare class RateLimiter {
    private readonly buckets;
    consume({ key, limit, windowMs, now }: RateLimitOptions): RateLimitResult;
    private prune;
}
export {};
//# sourceMappingURL=rateLimiter.d.ts.map