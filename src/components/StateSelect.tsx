'use client';

import { useMemo } from 'react';
import { INDIAN_STATES, stateCodeFromName, type IndianState } from '@/lib/states';
import { SearchSelect } from './SearchSelect';

export function stateSelectHint(code?: string | null, name?: string | null) {
  if (code || !name?.trim() || stateCodeFromName(name)) return null;
  return `Saved as "${name.trim()}" - pick the state from the list`;
}

export function StateSelect({
  code,
  name,
  onChange,
  placeholder = 'Select a state',
  className = '',
  disabled = false,
  required = false,
}: {
  code?: string | null;
  name?: string | null;
  onChange: (state: IndianState | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const value = code || stateCodeFromName(name) || '';
  const options = useMemo(
    () => INDIAN_STATES.map((s) => ({ value: s.code, label: s.name, hint: s.code })),
    []
  );
  return (
    <SearchSelect
      value={value}
      options={options}
      onChange={(v) => onChange(INDIAN_STATES.find((s) => s.code === v) ?? null)}
      placeholder={placeholder}
      searchPlaceholder="Search states or code"
      emptyMessage="No state matches"
      className={`w-full ${className}`}
      disabled={disabled}
      required={required}
    />
  );
}
