import { isIP } from "node:net";

export type UrlValidationErrorCode =
  | "URL_REQUIRED"
  | "INVALID_URL"
  | "UNSUPPORTED_URL_SCHEME"
  | "URL_NOT_ALLOWED";

export class UrlValidationError extends Error {
  constructor(readonly code: UrlValidationErrorCode, message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export interface ValidatedUrl {
  originalUrl: string;
  normalizedUrl: string;
}

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const LOCAL_HOSTNAMES = new Set(["localhost"]);

export function validateShortLinkUrl(rawUrl: unknown): ValidatedUrl {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new UrlValidationError("URL_REQUIRED", "URL is required.");
  }

  const trimmedUrl = rawUrl.trim();

  if (trimmedUrl.length > MAX_URL_LENGTH) {
    throw new UrlValidationError("INVALID_URL", "URL is too long.");
  }

  let url: URL;

  try {
    url = new URL(trimmedUrl);
  } catch {
    throw new UrlValidationError("INVALID_URL", "URL is invalid.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UrlValidationError(
      "UNSUPPORTED_URL_SCHEME",
      "URL scheme is not supported.",
    );
  }

  const hostname = url.hostname.toLowerCase();

  if (LOCAL_HOSTNAMES.has(hostname) || isBlockedIpAddress(hostname)) {
    throw new UrlValidationError("URL_NOT_ALLOWED", "URL is not allowed.");
  }

  url.hash = "";

  return {
    originalUrl: trimmedUrl,
    normalizedUrl: url.toString(),
  };
}

function isBlockedIpAddress(hostname: string): boolean {
  const ipVersion = isIP(hostname);

  if (ipVersion === 4) {
    return isBlockedIpv4(hostname);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(hostname);
  }

  return false;
}

function isBlockedIpv4(ipAddress: string): boolean {
  const parts = ipAddress.split(".").map((part) => Number(part));
  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isBlockedIpv6(ipAddress: string): boolean {
  const normalized = ipAddress.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}
