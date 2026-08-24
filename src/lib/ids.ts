const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId(prefix: string): string {
  let s = ''
  const rand = crypto.getRandomValues(new Uint8Array(8))
  for (const b of rand) s += ALPHABET[b % ALPHABET.length]
  return `${prefix}-${s}`
}
