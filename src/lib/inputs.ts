export const phoneValue = (value: string) => value.replace(/[^\d+\s-]/g, '').slice(0, 16);

export const pincodeValue = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const panValue = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

export const PHONE_INPUT = { type: 'tel', inputMode: 'tel', autoComplete: 'tel' } as const;

export const PINCODE_INPUT = { inputMode: 'numeric', maxLength: 6, autoComplete: 'postal-code' } as const;

export function panProblem(pan: string) {
  if (!pan) return null;
  if (pan.length < 10) return null;
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? null : 'A PAN looks like ABCDE1234F';
}
