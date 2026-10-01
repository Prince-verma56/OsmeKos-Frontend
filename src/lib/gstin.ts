import { stateName } from '@/lib/states';

const CODES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const cleanGstin = (value: string) => value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);

function checkDigit(first14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = CODES.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CODES[(36 - (sum % 36)) % 36];
}

export type GstinInfo = {
  gstin: string;
  stateCode: string;
  pan: string;
  complete: boolean;
  error: string | null;
  warning: string | null;
  summary: string | null;
};

export const NEEDS_GSTIN = ['REGISTERED_REGULAR', 'REGISTERED_COMPOSITION', 'SEZ'];

export function gstinInfo(value: string): GstinInfo {
  const gstin = cleanGstin(value);
  const stateCode = /^\d{2}$/.test(gstin.slice(0, 2)) ? gstin.slice(0, 2) : '';
  const known = !!stateCode && stateName(stateCode) !== stateCode;
  const complete = gstin.length === 15 && FORMAT.test(gstin) && known;

  const error =
    !gstin ? null
    : stateCode && !known ? `${stateCode} is not an Indian state code`
    : gstin.length < 15 ? null
    : !FORMAT.test(gstin) ? 'That is not the shape of a GSTIN - 22AAAAA0000A1Z5'
    : gstin[12] === '0' ? 'The 13th character of a GSTIN is never 0 - check the number'
    : checkDigit(gstin.slice(0, 14)) !== gstin[14]
      ? 'That GSTIN fails its own check digit - read it again from the certificate'
      : null;

  const warning = null;

  return {
    gstin,
    stateCode,
    pan: complete ? gstin.slice(2, 12) : '',
    complete,
    error,
    warning,
    summary: complete ? `${stateName(stateCode)} · PAN ${gstin.slice(2, 12)}` : null,
  };
}
