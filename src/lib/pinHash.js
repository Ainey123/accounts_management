import crypto from 'crypto';

/**
 * Hash a PIN using SHA-256.
 * Not as strong as bcrypt but works without native add-ons in Next.js edge/serverless.
 */
export function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}
