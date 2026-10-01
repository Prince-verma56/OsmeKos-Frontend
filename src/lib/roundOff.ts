import { currencyInfo, currencySymbol, formatPrefs } from './formatPrefs';

export type RoundOffMode = 'NONE' | 'NEAREST_1' | 'NEAREST_0_10' | 'DOWN_1';

export function roundOffOptions(): { value: RoundOffMode; label: string; hint: string }[] {
  const s = currencySymbol();
  const minor = currencyInfo(formatPrefs().currency).minor.toLowerCase();
  return [
    { value: 'NEAREST_1', label: `Nearest ${s}1`, hint: `${s}1,180.49 becomes ${s}1,180 and ${s}1,180.50 becomes ${s}1,181` },
    { value: 'NEAREST_0_10', label: `Nearest ${s}0.10`, hint: `${s}1,180.44 becomes ${s}1,180.40` },
    { value: 'DOWN_1', label: `Always down to ${s}1`, hint: `${s}1,180.99 becomes ${s}1,180 — never charges more` },
    { value: 'NONE', label: 'Off', hint: `Totals keep their ${minor}` },
  ];
}

export function roundOffFor(total: number, mode: RoundOffMode | null | undefined): number {
  const paise = Math.round(total * 100);
  const halfUp = (p: number, step: number) =>
    Math.sign(p) * Math.floor(Math.abs(p) / step + 0.5) * step;
  let target = paise;
  if (mode === 'NEAREST_1') target = halfUp(paise, 100);
  else if (mode === 'NEAREST_0_10') target = halfUp(paise, 10);
  else if (mode === 'DOWN_1') target = Math.floor(paise / 100) * 100;
  return (target - paise) / 100;
}

export function resolveRoundOff(total: number, typed: string, mode: RoundOffMode | null | undefined) {
  const manual = typed.trim() !== '' && Number.isFinite(Number(typed));
  const value = manual ? Math.round(Number(typed) * 100) / 100 : roundOffFor(total, mode);
  return { manual, value, payload: manual ? value : null };
}
