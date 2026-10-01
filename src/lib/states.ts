export type IndianState = { code: string; name: string };

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

const BY_CODE = new Map(INDIAN_STATES.map((s) => [s.code, s]));

export function stateLabel(code?: string | null): string {
  if (!code) return '';
  const state = BY_CODE.get(code);
  return state ? `[${state.code}] ${state.name}` : code;
}

export function stateName(code?: string | null): string {
  if (!code) return '';
  return BY_CODE.get(code)?.name ?? code;
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');
const BY_NAME = new Map(INDIAN_STATES.map((s) => [squash(s.name), s.code]));

export function stateCodeFromName(name?: string | null): string | null {
  if (!name) return null;
  return BY_NAME.get(squash(name)) ?? (BY_CODE.has(name.trim()) ? name.trim() : null);
}

export function stateCodeFromGstin(gstin?: string | null): string | null {
  const code = gstin?.trim().slice(0, 2);
  return code && BY_CODE.has(code) ? code : null;
}
