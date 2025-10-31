import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
}

export function encryptApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET not configured for encryption");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const result = Buffer.concat([salt, iv, tag, encrypted]);
  return result.toString("base64");
}

export function decryptApiKey(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET not configured for decryption");
  }

  try {
    const buffer = Buffer.from(encryptedData, "base64");
    
    if (buffer.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
      console.warn("Invalid encrypted data format (too short), returning null");
      return null;
    }
    
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = deriveKey(secret, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.warn("Failed to decrypt API key (likely legacy plaintext data), returning null:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
