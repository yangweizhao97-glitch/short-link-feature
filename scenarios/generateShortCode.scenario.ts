import { generateShortCode } from "../src/short-links/index.js";

const code = generateShortCode();
console.log("Default short code:", code);

const customLengthCode = generateShortCode(8);
console.log("Custom length short code:", customLengthCode);
