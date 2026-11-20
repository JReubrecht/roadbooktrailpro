import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Dérive une clé 256 bits stable depuis INTERVALS_ENCRYPTION_KEY (64 hex chars ou passphrase).
 * Note : En production, INTERVALS_ENCRYPTION_KEY doit être défini et strictement gardé secret côté serveur.
 */
function getEncryptionKeyBuffer(): Buffer {
  const configuredKey = process.env.INTERVALS_ENCRYPTION_KEY?.trim();

  if (!configuredKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'INTERVALS_ENCRYPTION_KEY manquante en production (clé AES-256-GCM 64 caractères hex requise).'
      );
    }
    const devFallback = 'dev-only-mykairn-coach-intervals-aes256-gcm-key-change-in-prod';
    return crypto.createHash('sha256').update(devFallback).digest();
  }

  if (/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
    return Buffer.from(configuredKey, 'hex');
  }

  if (configuredKey.length < 16) {
    throw new Error('INTERVALS_ENCRYPTION_KEY trop courte (minimum 16 caractères ou 64 hex).');
  }

  return crypto.createHash('sha256').update(configuredKey).digest();
}

/**
 * Chiffre une clé API ou secret Intervals.icu en AES-256-GCM.
 * Format retourné : `ivBase64:authTagBase64:cipherTextBase64`
 */
export function encryptIntervalsSecret(plainText: string): string {
  const clean = plainText.trim();
  if (!clean) {
    throw new Error('Impossible de chiffrer un secret vide.');
  }

  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Déchiffre côté serveur un secret chiffré par `encryptIntervalsSecret`.
 */
export function decryptIntervalsSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Format de secret chiffré invalide.');
  }

  const [ivB64, authTagB64, cipherB64] = parts;
  const key = getEncryptionKeyBuffer();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
