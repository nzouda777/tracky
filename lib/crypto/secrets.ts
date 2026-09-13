import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = "v1";

function key(): Buffer {
  const decoded = Buffer.from(env.encryptionKey, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes encoded as base64 (openssl rand -base64 32).",
    );
  }
  return decoded;
}

/**
 * Encrypts a secret for storage at rest (Shopify access tokens).
 * Output format: `v1.<iv base64url>.<authTag base64url>.<ciphertext base64url>`
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted secret.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivPart, "base64url"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time comparison of two strings of arbitrary length. */
export function safeEqual(a: string, b: string): boolean {
  // Hash both sides first so lengths always match and no length is leaked.
  const digest = (value: string) =>
    createHmac("sha256", "compare").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** URL-safe random token used for tracking links and agency invites. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
