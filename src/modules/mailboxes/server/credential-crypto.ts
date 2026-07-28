import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// Encrypts/decrypts mailboxes.encrypted_credential entirely in Node — the
// master key (MAILBOX_CREDENTIAL_ENCRYPTION_KEY) never leaves this process
// and is never sent to Postgres as an RPC argument, unlike the pgp_sym_encrypt
// approach prototyped (and only prototyped, then removed) in email-db. AES-256-GCM
// is authenticated encryption: the auth tag detects tampering/corruption, not
// just confidentiality.
//
// Server-only module — must never be imported from a 'use client' file or any
// code path reachable from a normal authenticated user session. The only
// caller is the sync worker (service-role context) and the OAuth
// callback/IMAP-connect actions (which write but never read back plaintext
// to the client).
//
// KEY ROTATION — known v1 limitation, not solved here: this is a single
// global key. Rotating MAILBOX_CREDENTIAL_ENCRYPTION_KEY makes every
// previously-encrypted value permanently undecryptable — there is no
// re-encryption migration path in this branch. If rotation is ever needed,
// it requires decrypting everything with the old key and re-encrypting with
// the new one before the old key is discarded.

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // recommended for GCM
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const keyB64 = process.env.MAILBOX_CREDENTIAL_ENCRYPTION_KEY
  if (!keyB64) {
    throw new Error('MAILBOX_CREDENTIAL_ENCRYPTION_KEY is not set')
  }
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) {
    throw new Error('MAILBOX_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)')
  }
  return key
}

// Output layout: [12-byte IV][16-byte auth tag][ciphertext] — stored as a
// single bytea column value, no separate columns needed for IV/tag.
export function encryptCredential(plaintext: string): Buffer {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted])
}

export function decryptCredential(stored: Buffer): string {
  const key = getKey()
  const iv = stored.subarray(0, IV_LENGTH)
  const authTag = stored.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = stored.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
