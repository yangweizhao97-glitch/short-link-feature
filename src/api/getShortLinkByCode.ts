import {
  JsonShortLinkRepository,
  type ShortLinkRepository,
} from "../shortLinkRepository.js";
import type {
  ApiErrorBody,
  ApiResponse,
  RedirectResponse,
} from "../shortLinkTypes.js";

export interface GetShortLinkByCodeRequest {
  method: string;
  params: {
    code?: unknown;
  };
}

export interface GetShortLinkByCodeOptions {
  repository?: ShortLinkRepository;
  now?: Date;
}

const SHORT_CODE_PATTERN = /^[A-Za-z0-9]+$/;

export async function getShortLinkByCode(
  request: GetShortLinkByCodeRequest,
  options: GetShortLinkByCodeOptions = {},
): Promise<RedirectResponse | ApiResponse<ApiErrorBody>> {
  if (request.method.toUpperCase() !== "GET") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method is not allowed.");
  }

  const code = request.params.code;

  if (typeof code !== "string" || !SHORT_CODE_PATTERN.test(code)) {
    return errorResponse(400, "INVALID_SHORT_CODE", "Short code is invalid.");
  }

  const repository = options.repository ?? new JsonShortLinkRepository();
  const record = await repository.findByShortCode(code);

  if (!record) {
    return errorResponse(404, "SHORT_LINK_NOT_FOUND", "Short link was not found.");
  }

  const now = options.now ?? new Date();

  if (record.expiresAt !== null && new Date(record.expiresAt) < now) {
    return errorResponse(410, "SHORT_LINK_EXPIRED", "Short link has expired.");
  }

  await repository.incrementVisitCount(code, now.toISOString());

  return {
    status: 302,
    headers: {
      Location: record.originalUrl,
    },
  };
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
