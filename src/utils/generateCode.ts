import { randomBytes } from "crypto";

export function generateNumericCode(): string {
  const random = randomBytes(4).readUInt32BE(0);
  const code = random % 1000000;
  return code.toString().padStart(6, "0");
}
