interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
    if (record.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  let record = rateLimitMap.get(identifier);

  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(identifier, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}

export function getClientIp(req: any): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}
