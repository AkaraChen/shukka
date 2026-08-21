import './setup-db.ts'
import { describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, hashPassword, verifyPassword } from '~/lib/crypto.ts'
import { ShukkaError } from '~/lib/errors.ts'

describe('secret handling', () => {
  it('round-trips S3 secrets without storing plaintext', () => {
    const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    const encrypted = encryptSecret(secret)
    expect(encrypted).not.toContain(secret)
    expect(decryptSecret(encrypted)).toBe(secret)
  })

  it('produces a different ciphertext each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('secret')
    const [iv, tag, body] = encrypted.split('.')
    expect(() => decryptSecret([iv, tag, `${body.slice(0, -4)}AAAA`].join('.'))).toThrow(ShukkaError)
  })

  it('throws storage_error for a garbage payload', () => {
    expect(() => decryptSecret('not-a-secret')).toThrow(ShukkaError)
    try {
      decryptSecret('not-a-secret')
    } catch (error) {
      expect(error).toBeInstanceOf(ShukkaError)
      expect((error as ShukkaError).code).toBe('storage_error')
      expect((error as ShukkaError).message).toBe('Stored S3 secret cannot be decrypted')
    }
  })

  it('throws storage_error when the ciphertext cannot be deciphered', () => {
    const encrypted = encryptSecret('secret')
    const [iv, tag, body] = encrypted.split('.')
    const broken = [iv, tag, `${body.slice(0, -4)}AAAA`].join('.')
    expect(() => decryptSecret(broken)).toThrow(ShukkaError)
    try {
      decryptSecret(broken)
    } catch (error) {
      expect(error).toBeInstanceOf(ShukkaError)
      expect((error as ShukkaError).code).toBe('storage_error')
      expect((error as ShukkaError).message).toBe('Stored S3 secret cannot be decrypted')
      expect((error as ShukkaError).message).not.toContain(broken)
    }
  })

  it('verifies passwords against their stored hash only', () => {
    const stored = hashPassword('correct horse battery')
    expect(stored).not.toContain('correct horse battery')
    expect(verifyPassword('correct horse battery', stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })
})
