/**
 * Application-level encryption layer on top of PropertiesService.
 *
 * IMPORTANT (see docs/architecture/SECURITY_ARCHITECTURE.md and the Architecture Review Report,
 * Security Review #3): PropertiesService is plaintext to anyone with edit access to this Apps
 * Script project. This module is defense-in-depth — it means a leaked Script Properties export
 * isn't immediately usable — it is NOT a substitute for a real secrets manager. For anything
 * beyond a single-owner v1 deployment, proxy secrets through a real KMS instead.
 *
 * Implementation: an HMAC-SHA256-derived keystream (essentially hand-rolled CTR mode) XORed with
 * the plaintext, then encrypt-then-MAC with a second HMAC tag over the ciphertext for integrity.
 * GAS's Utilities service has no built-in AES, so this uses only primitives it actually provides.
 */

function encryptSecretValue_(plaintext, passphrase) {
  var nonce = Utilities.getUuid();
  var plaintextBytes = Utilities.newBlob(plaintext).getBytes();
  var keystream = deriveKeystream_(passphrase, nonce, plaintextBytes.length);
  var ciphertextBytes = xorBytes_(plaintextBytes, keystream);
  var tag = Utilities.computeHmacSha256Signature(bytesToBase64_(ciphertextBytes) + nonce, passphrase);
  return [
    base64UrlEncode_(nonce),
    base64UrlEncode_(ciphertextBytes),
    base64UrlEncode_(tag),
  ].join('.');
}

function decryptSecretValue_(payload, passphrase) {
  var parts = String(payload || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret payload');
  var nonce = base64UrlDecodeToString_(parts[0]);
  var ciphertextBytes = Utilities.base64DecodeWebSafe(padBase64_(parts[1]));
  var expectedTag = Utilities.computeHmacSha256Signature(bytesToBase64_(ciphertextBytes) + nonce, passphrase);
  var expectedTagB64 = base64UrlEncode_(expectedTag);
  if (!timingSafeEqual_(parts[2], expectedTagB64)) throw new Error('Secret payload failed integrity check');
  var keystream = deriveKeystream_(passphrase, nonce, ciphertextBytes.length);
  var plaintextBytes = xorBytes_(ciphertextBytes, keystream);
  return Utilities.newBlob(plaintextBytes).getDataAsString();
}

/** Stores an already-application-encrypted secret in Script Properties. */
function setEncryptedScriptSecret_(key, plaintext) {
  var passphrase = getRequiredScriptProperty_('SECRET_ENCRYPTION_PASSPHRASE');
  PropertiesService.getScriptProperties().setProperty(key, encryptSecretValue_(plaintext, passphrase));
}

/** Reads and decrypts a secret previously stored with setEncryptedScriptSecret_. */
function getDecryptedScriptSecret_(key) {
  var passphrase = getRequiredScriptProperty_('SECRET_ENCRYPTION_PASSPHRASE');
  var payload = getRequiredScriptProperty_(key);
  return decryptSecretValue_(payload, passphrase);
}

function deriveKeystream_(passphrase, nonce, lengthBytes) {
  var blocks = [];
  var counter = 0;
  var produced = 0;
  while (produced < lengthBytes) {
    var block = Utilities.computeHmacSha256Signature(nonce + ':' + counter, passphrase);
    blocks = blocks.concat(block);
    produced += block.length;
    counter += 1;
  }
  return blocks.slice(0, lengthBytes);
}

function xorBytes_(bytes, keystream) {
  var out = [];
  for (var i = 0; i < bytes.length; i += 1) {
    // GAS byte arrays are signed (-128..127); mask to unsigned before XOR, then back.
    out.push(((bytes[i] & 0xff) ^ (keystream[i] & 0xff)) << 24 >> 24);
  }
  return out;
}

function bytesToBase64_(bytes) {
  return Utilities.base64Encode(bytes);
}

function padBase64_(value) {
  return value + Array((4 - (value.length % 4)) % 4 + 1).join('=');
}
