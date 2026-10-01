export type RuleName = 'email' | 'mobile' | 'landline' | 'pincode' | 'pan' | 'ifsc' | 'website';

const RULES: Record<RuleName, (value: string) => string | null> = {
  email: (v) => (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) ? null : 'Enter a valid email, like name@example.com'),
  mobile: (v) => {
    const digits = v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
    if (!/^\d+$/.test(digits)) return 'A mobile number has digits only';
    if (digits.length !== 10) return `A mobile number has 10 digits - this one has ${digits.length}`;
    if (!/^[6-9]/.test(digits)) return 'An Indian mobile number starts with 6, 7, 8 or 9';
    return null;
  },
  landline: (v) => {
    const digits = v.replace(/[\s()+-]/g, '');
    if (!/^\d+$/.test(digits)) return 'A phone number has digits only';
    return digits.length >= 10 && digits.length <= 13 ? null : 'Enter the number with its STD code, e.g. 011 2345 6789';
  },
  pincode: (v) => (/^[1-9]\d{5}$/.test(v.trim()) ? null : 'A pincode has 6 digits and does not start with 0'),
  pan: (v) => (/^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase()) ? null : 'A PAN looks like ABCDE1234F'),
  ifsc: (v) => (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase()) ? null : 'An IFSC looks like HDFC0001234'),
  website: (v) =>
    /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(v.trim()) ? null : 'Enter a web address, like www.example.com',
};

export function ruleFor(input: HTMLInputElement, label: string): RuleName | null {
  if (input.dataset.rule) return (input.dataset.rule as RuleName) || null;
  if (input.tagName !== 'INPUT') return null;
  if (['hidden', 'checkbox', 'radio', 'number', 'date', 'password', 'file', 'search'].includes(input.type)) return null;
  const own = `${input.getAttribute('aria-label') ?? ''} ${input.placeholder ?? ''}`.toLowerCase();
  const ownRule = own.trim() ? ruleFromText(input, own, false) : null;
  if (ownRule) return ownRule;
  return ruleFromText(input, label.toLowerCase(), true);
}

function ruleFromText(input: HTMLInputElement, l: string, useType: boolean): RuleName | null {
  if ((useType && input.type === 'email') || /\be-?mail\b/.test(l)) return 'email';
  if (/\bwork\s*phone\b|\blandline\b|\bfax\b/.test(l)) return 'landline';
  if ((useType && (input.type === 'tel' || input.autocomplete === 'tel')) || /\b(phone|mobile|whatsapp)\b/.test(l)) return 'mobile';
  if ((useType && input.autocomplete === 'postal-code') || /\bpin\s*code\b|\bpincode\b/.test(l)) return 'pincode';
  if (/\bpan\b/.test(l)) return 'pan';
  if (/\bifsc\b/.test(l)) return 'ifsc';
  if ((useType && input.type === 'url') || /\bwebsite\b/.test(l)) return 'website';
  return null;
}

export function checkValue(rule: RuleName | null, value: string): string | null {
  if (!rule) return null;
  const v = value.trim();
  if (!v) return null;
  return RULES[rule](v);
}

export const VALIDATE_EVENT = 'osmekos:validate';

export function validateWithin(scope: Element | null): HTMLElement | null {
  if (!scope) return null;
  scope.querySelectorAll('[data-field]').forEach((el) => el.dispatchEvent(new Event(VALIDATE_EVENT)));
  return scope.querySelector<HTMLElement>('[data-field][data-invalid="true"]');
}

export function goToField(field: HTMLElement) {
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = field.querySelector<HTMLElement>(
    'input:not([type=hidden]):not([aria-hidden]), textarea, select, button[aria-haspopup]'
  );
  control?.focus({ preventScroll: true });
}

export function problemMessage(scope: Element, field: HTMLElement): string {
  const label = field.dataset.label?.trim();
  const problem = field.dataset.problem?.trim() || 'needs fixing';
  const count = scope.querySelectorAll('[data-field][data-invalid="true"]').length;
  const one = label ? `${label}: ${problem}` : problem;
  return count > 1 ? `${one} (and ${count - 1} more to fix)` : one;
}
