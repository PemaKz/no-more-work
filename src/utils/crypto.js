const crypto = require('crypto');
const path = require('path');
const { EnvManager } = require('zyket');

// Salt fijo para derivar la masterKey desde el passphrase. No es secreto —
// el secreto es el passphrase (SECRETS_KEY). La aleatoriedad real por
// cifrado vive en el IV, que es aleatorio por cada llamada a encrypt().
const KDF_SALT = Buffer.from('nmw-secrets-v1');

let masterKeyCache = null;

/**
 * Devuelve la masterKey de 32 bytes derivada del passphrase de entorno
 * SECRETS_KEY. Si no existe, genera uno fuerte, lo persiste en .env y avisa.
 */
function getMasterKey() {
  if (masterKeyCache) return masterKeyCache;

  let passphrase = process.env.SECRETS_KEY;
  if (!passphrase) {
    passphrase = crypto.randomBytes(32).toString('hex');
    const envPath = path.join(process.cwd(), '.env');
    try {
      EnvManager.addEnvVariable(envPath, 'SECRETS_KEY', passphrase);
      console.warn(
        '[crypto] SECRETS_KEY no estaba definido. Generado uno nuevo y añadido a .env. ' +
          'NO COMPARTAS esta clave — descifra todos los secrets de la app.'
      );
    } catch (err) {
      console.warn(
        '[crypto] No se pudo persistir SECRETS_KEY en .env:',
        err.message
      );
    }
    process.env.SECRETS_KEY = passphrase;
  }

  masterKeyCache = crypto.scryptSync(passphrase, KDF_SALT, 32);
  return masterKeyCache;
}

/**
 * AES-256-GCM. Devuelve `iv:tag:ciphertext` en base64.
 * Devuelve null si plaintext es null/undefined; "" se cifra como cualquier
 * otro string.
 */
function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ct.toString('base64'),
  ].join(':');
}

/**
 * Descifra un valor producido por encrypt(). Si el formato es inválido o la
 * clave no coincide (tag GCM falla), devuelve null en lugar de lanzar.
 */
function decrypt(packed) {
  if (!packed) return null;
  try {
    const [ivB64, tagB64, ctB64] = packed.split(':');
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const key = getMasterKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      'utf8'
    );
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
