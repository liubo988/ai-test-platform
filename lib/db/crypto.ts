import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const raw = process.env.APP_CRYPTO_KEY || 'unsafe-dev-key-change-me';
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plainText?: string | null): string | null {
  if (!plainText) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(cipherText?: string | null): string {
  if (!cipherText) return '';
  try {
    const [ivHex, tagHex, dataHex] = cipherText.split(':');
    if (!ivHex || !tagHex || !dataHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGO, getSecretKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return '';
  }
}
