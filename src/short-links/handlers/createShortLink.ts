import { generateShortCode } from "../domain/generateShortCode.js";
import {
  JsonShortLinkRepository,
  type ShortLinkRepository,
} from "../repositories/shortLinkRepository.js";
import type {
  ApiErrorBody,
  ApiResponse,
  ShortLinkRecord,
} from "../domain/shortLinkTypes.js";
import {
  UrlValidationError,
  validateShortLinkUrl,
} from "../domain/validateShortLinkUrl.js";

export interface PostShortLinksRequest {
  method: string;
  body?: {
    url?: unknown;
  };
}

export interface PostShortLinksOptions {
  repository?: ShortLinkRepository;
  shortLinkBaseUrl?: string;
}

const MAX_SHORT_CODE_ATTEMPTS = 5;
const DEFAULT_SHORT_LINK_BASE_URL = "https://s.example.com";

export async function postShortLinks(
  request: PostShortLinksRequest,
  options: PostShortLinksOptions = {},
): Promise<ApiResponse<ShortLinkRecord | ApiErrorBody>> {
  if (request.method.toUpperCase() !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method is not allowed.");
  }

  const repository = options.repository ?? new JsonShortLinkRepository();
  const shortLinkBaseUrl =
    options.shortLinkBaseUrl ?? DEFAULT_SHORT_LINK_BASE_URL;

  try {
    const validatedUrl = validateShortLinkUrl(request.body?.url);
    const shortCode = await generateUniqueShortCode(repository);
    const now = new Date().toISOString();
    const shortUrl = buildShortUrl(shortLinkBaseUrl, shortCode);

    const record = await repository.create({
      originalUrl: validatedUrl.originalUrl,
      normalizedUrl: validatedUrl.normalizedUrl,
      shortCode,
      shortUrl,
      now,
    });

    return {
      status: 201,
      body: record,
    };
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return errorResponse(400, error.code, error.message);
    }

    if (isShortCodeGenerationError(error)) {
      return errorResponse(
        500,
        "SHORT_CODE_GENERATION_FAILED",
        "Short code generation failed.",
      );
    }

    return errorResponse(500, "INTERNAL_ERROR", "Internal server error.");
  }
}

async function generateUniqueShortCode(
  repository: ShortLinkRepository,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt += 1) {
    const shortCode = generateShortCode();

    if (!(await repository.existsByShortCode(shortCode))) {
      return shortCode;
    }
  }

  throw new Error("SHORT_CODE_GENERATION_FAILED");
}

function buildShortUrl(shortLinkBaseUrl: string, shortCode: string): string {
  return `${shortLinkBaseUrl.replace(/\/+$/, "")}/${shortCode}`;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): ApiResponse<ApiErrorBody> {
  return {
    status,
    body: {
      code,
      message,
    },
  };
}

function isShortCodeGenerationError(error: unknown): boolean {
  return (
    error instanceof Error && error.message === "SHORT_CODE_GENERATION_FAILED"
  );
}
