import crypto from "crypto";

function generateJwtSecret() {
  return crypto.randomBytes(64).toString("hex");
}

const jwtSecret = generateJwtSecret();
console.log(jwtSecret);
