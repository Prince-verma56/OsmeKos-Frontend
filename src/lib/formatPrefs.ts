export type CurrencyInfo = { name: string; minor: string; locale: string; indian?: boolean };

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const CURRENCIES: Record<string, CurrencyInfo> = {
  INR: { name: 'Indian Rupee', minor: 'Paise', locale: 'en-IN', indian: true },
  USD: { name: 'US Dollar', minor: 'Cents', locale: 'en-US' },
  EUR: { name: 'Euro', minor: 'Cents', locale: 'en-IE' },
  GBP: { name: 'Pound Sterling', minor: 'Pence', locale: 'en-GB' },
  AED: { name: 'UAE Dirham', minor: 'Fils', locale: 'en-AE' },
  SAR: { name: 'Saudi Riyal', minor: 'Halalas', locale: 'en-SA' },
  SGD: { name: 'Singapore Dollar', minor: 'Cents', locale: 'en-SG' },
  AUD: { name: 'Australian Dollar', minor: 'Cents', locale: 'en-AU' },
  CAD: { name: 'Canadian Dollar', minor: 'Cents', locale: 'en-CA' },
  NPR: { name: 'Nepalese Rupee', minor: 'Paisa', locale: 'en-IN', indian: true },
  BDT: { name: 'Bangladeshi Taka', minor: 'Poisha', locale: 'en-IN', indian: true },
  LKR: { name: 'Sri Lankan Rupee', minor: 'Cents', locale: 'en-US' },
};

export const currencyInfo = (code: string): CurrencyInfo =>
  CURRENCIES[code] ?? { name: code, minor: 'Cents', locale: 'en-US' };

export function isTimeZone(tz?: string | null) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [DEFAULT_TIMEZONE, 'UTC'];
  }
}

export function timeZoneOffset(tz: string) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value.replace('GMT', 'UTC') ?? '';
  } catch {
    return '';
  }
}

const STORE_KEY = 'osmekos.format';

type Prefs = { currency: string; timezone: string };

const prefs: Prefs = { currency: DEFAULT_CURRENCY, timezone: DEFAULT_TIMEZONE };

type Cache = {
  money: Intl.NumberFormat;
  number: Intl.NumberFormat;
  calendar: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  symbol: string;
};
let cache: Cache | null = null;

function apply(next: Partial<Prefs>) {
  const currency = next.currency && /^[A-Z]{3}$/.test(next.currency) ? next.currency : prefs.currency;
  const timezone = isTimeZone(next.timezone) ? (next.timezone as string) : prefs.timezone;
  if (currency === prefs.currency && timezone === prefs.timezone) return false;
  prefs.currency = currency;
  prefs.timezone = timezone;
  cache = null;
  return true;
}

if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved) apply(saved);
  } catch {}
}

export function setFormatPrefs(next?: { baseCurrency?: string | null; timezone?: string | null } | null) {
  if (!next) return;
  apply({ currency: next.baseCurrency ?? undefined, timezone: next.timezone ?? undefined });
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
  } catch {}
}

export const formatPrefs = (): Prefs => ({ ...prefs });

function formatters(): Cache {
  if (cache) return cache;
  const { locale } = currencyInfo(prefs.currency);
  let money: Intl.NumberFormat;
  try {
    money = new Intl.NumberFormat(locale, { style: 'currency', currency: prefs.currency });
  } catch {
    money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: DEFAULT_CURRENCY });
  }
  const symbol = money.formatToParts(0).find((p) => p.type === 'currency')?.value ?? prefs.currency;
  cache = {
    money,
    number: new Intl.NumberFormat(locale),
    calendar: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: prefs.timezone }),
    dateTime: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: prefs.timezone,
    }),
    symbol,
  };
  return cache;
}

export const numberLocale = () => currencyInfo(prefs.currency).locale;

export const currencySymbol = () => formatters().symbol;

export const formatMoney = (v: unknown) => formatters().money.format(Number(v ?? 0));

export const formatNumber = (v: unknown) => formatters().number.format(Number(v ?? 0));

const isCalendarDay = (v: string, d: Date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ||
  (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0);

export function formatDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return (isCalendarDay(v, d) ? formatters().calendar : formatters().date).format(d);
}

export function todayIso() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: prefs.timezone,
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function formatDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return formatters().dateTime.format(d);
}
