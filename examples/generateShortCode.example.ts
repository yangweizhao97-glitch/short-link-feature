import { generateShortCode } from "../src/generateShortCode.js";

const code = generateShortCode();
console.log(code);

const customLengthCode = generateShortCode(8);
console.log(customLengthCode);
