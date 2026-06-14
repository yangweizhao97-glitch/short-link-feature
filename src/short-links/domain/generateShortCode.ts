import { randomInt } from "node:crypto";

const DEFAULT_CODE_LENGTH = 6;
const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateShortCode(length = DEFAULT_CODE_LENGTH): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("Code length must be a positive integer.");
  }

  let code = "";

  for (let i = 0; i < length; i += 1) {
    const index = randomInt(0, CODE_ALPHABET.length);
    code += CODE_ALPHABET[index];
  }

  return code;
}
