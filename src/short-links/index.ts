export { generateShortCode } from "./domain/generateShortCode.js";
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
