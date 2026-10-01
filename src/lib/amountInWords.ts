import { currencyInfo, formatPrefs } from './formatPrefs';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const rest = n % 10;
  return rest ? `${tens} ${ONES[rest]}` : tens;
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundreds) return underHundred(rest);
  return rest ? `${ONES[hundreds]} Hundred ${underHundred(rest)}` : `${ONES[hundreds]} Hundred`;
}

function internationalWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  let rest = n;
  for (const [size, label] of [
    [1e9, 'Billion'],
    [1e6, 'Million'],
    [1e3, 'Thousand'],
  ] as const) {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${underThousand(count)} ${label}`);
    rest %= size;
  }
  if (rest) parts.push(underThousand(rest));
  return parts.join(' ');
}

function integerWords(n: number): string {
  if (n === 0) return 'Zero';

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${integerWords(crore)} Crore`);
  if (lakh) parts.push(`${underHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${underHundred(thousand)} Thousand`);
  if (rest) parts.push(underThousand(rest));

  return parts.join(' ');
}

export function amountInWords(value: unknown, currencyCode = formatPrefs().currency): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '';
  const info = currencyInfo(currencyCode);

  const negative = n < 0;
  const paise = Math.round(Math.abs(n) * 100);
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;

  const words = [
    negative ? 'Minus' : '',
    info.name,
    info.indian ? integerWords(rupees) : internationalWords(rupees),
    fraction ? `and ${underHundred(fraction)} ${info.minor}` : '',
    'Only',
  ]
    .filter(Boolean)
    .join(' ');

  return words;
}
