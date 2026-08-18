import './setup-db.ts'
import { describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, hashPassword, verifyPassword } from '~/lib/crypto.ts'

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
    expect(() => decryptSecret([iv, tag, `${body.slice(0, -4)}AAAA`].join('.'))).toThrow()
  })

  it('verifies passwords against their stored hash only', () => {
    const stored = hashPassword('correct horse battery')
    expect(stored).not.toContain('correct horse battery')
    expect(verifyPassword('correct horse battery', stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })
})
