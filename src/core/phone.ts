/** Kenyan mobile numbers in E.164: +2547XXXXXXXX or +2541XXXXXXXX. */
export const KENYAN_E164 = /^\+254(7|1)\d{8}$/

export function isValidKenyanPhone(phone: string): boolean {
  return KENYAN_E164.test(phone)
}

/** Accepts 07XX…, 7XX…, 2547XX…, +2547XX… (with spaces/dashes) and returns E.164 or null. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '')
  let candidate = digits
  if (/^0(7|1)\d{8}$/.test(digits)) candidate = `+254${digits.slice(1)}`
  else if (/^(7|1)\d{8}$/.test(digits)) candidate = `+254${digits}`
  else if (/^254(7|1)\d{8}$/.test(digits)) candidate = `+${digits}`
  return isValidKenyanPhone(candidate) ? candidate : null
}

/** "+254712345321" → "+2547•••••321" */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '•••'
  return `${phone.slice(0, 5)}${'•'.repeat(phone.length - 8)}${phone.slice(-3)}`
}
