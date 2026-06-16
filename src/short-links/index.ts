export { generateShortCode } from "./domain/generateShortCode.js";
export {
  SHORT_CODE_ALPHABET,
  SHORT_CODE_LENGTH,
  SHORT_CODE_PATTERN,
  isValidShortCode,
} from "./domain/shortCode.js";
export {
  UrlValidationError,
  validateShortLinkUrl,
} from "./domain/validateShortLinkUrl.js";
export type {
  ApiErrorBody,
  ApiResponse,
  RedirectResponse,
  ShortLinkRecord,
  ShortLinkStatus,
} from "./domain/shortLinkTypes.js";
export {
  JsonShortLinkRepository,
  type CreateShortLinkRecordInput,
  type ShortLinkRepository,
} from "./repositories/shortLinkRepository.js";
export { postShortLinks } from "./handlers/createShortLink.js";
export { getShortLinkByCode } from "./handlers/redirectShortLink.js";
