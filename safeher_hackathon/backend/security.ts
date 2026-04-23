import crypto from "crypto";

const MAX_DEVICE_ID_LENGTH = 128;
const MIN_DEVICE_ID_LENGTH = 16;

/**
 * Hash an IP address to prevent storing raw IP data
 * Uses SHA-256 for consistent hashing
 */
export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Hash any identifier value using SHA-256.
 */
export function hashIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Extract client IP from request headers
 * Handles proxied requests (X-Forwarded-For, etc.)
 */
export function getClientIp(req: any): string {
  // Check for X-Forwarded-For header (common with proxies)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = typeof forwarded === "string" ? forwarded.split(",") : forwarded;
    return (ips[0] || "").trim();
  }

  // Check for other common proxy headers
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return typeof xRealIp === "string" ? xRealIp : xRealIp[0];
  }

  // Fall back to direct connection IP
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

/**
 * Read a persistent device id sent by the client.
 * For web apps this should be an app-generated UUID, not a hardware MAC address.
 */
export function getClientDeviceId(req: any): string | null {
  const headerValue = req.headers["x-device-id"];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (
    trimmed.length < MIN_DEVICE_ID_LENGTH ||
    trimmed.length > MAX_DEVICE_ID_LENGTH
  ) {
    return null;
  }

  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize incident description to remove any potential PII
 * (This is a basic implementation; a more sophisticated approach might use NLP)
 */
export function sanitizeDescription(description: string): string {
  let sanitized = description;

  // Remove common PII patterns
  // Email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");

  // Phone numbers (basic pattern)
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");

  // Social Security numbers
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");

  // Credit card numbers
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[card]");

  // Names (this is tricky and imperfect, so we keep it minimal)
  // We'll rely on the user not including names in the description

  return sanitized;
}

/**
 * Validate that a file is an acceptable type for upload
 */
export function isValidMediaType(mimeType: string): boolean {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];

  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Validate file size (in bytes)
 */
export function isValidFileSize(fileSize: number, maxSizeBytes: number = 10 * 1024 * 1024): boolean {
  return fileSize > 0 && fileSize <= maxSizeBytes;
}

/**
 * Generate a random suffix for S3 keys to prevent enumeration
 */
export function generateRandomSuffix(): string {
  return crypto.randomBytes(8).toString("hex");
}
