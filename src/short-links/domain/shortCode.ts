export const SHORT_CODE_LENGTH = 6;
export const SHORT_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SHORT_CODE_PATTERN = new RegExp(
  `^[A-Za-z0-9]{${SHORT_CODE_LENGTH}}$`,
);

export function isValidShortCode(value: unknown): value is string {
  return typeof value === "string" && SHORT_CODE_PATTERN.test(value);
}
