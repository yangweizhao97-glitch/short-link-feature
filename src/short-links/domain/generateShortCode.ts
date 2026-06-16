import { randomInt } from "node:crypto";
import { SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from "./shortCode.js";

export function generateShortCode(length = SHORT_CODE_LENGTH): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("Code length must be a positive integer.");
  }

  let code = "";

  for (let i = 0; i < length; i += 1) {
    const index = randomInt(0, SHORT_CODE_ALPHABET.length);
    code += SHORT_CODE_ALPHABET[index];
  }

  return code;
}
