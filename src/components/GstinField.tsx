'use client';

import { cleanGstin, gstinInfo, type GstinInfo } from '@/lib/gstin';
import { Field, Input } from './ui';

export function GstinField({
  value,
  onChange,
  label = 'GSTIN',
  hint,
  placeholder = '09AAAAA0000A1Z5',
  required = false,
  disabled = false,
}: {
  value: string;
  onChange: (gstin: string, info: GstinInfo) => void;
  label?: string;
  hint?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const info = gstinInfo(value);
  return (
    <Field
      label={label}
      required={required}
      hint={
        info.error ? (
          <span className="text-destructive">{info.error}</span>
        ) : info.warning ? (
          <span className="text-warning">{info.warning}</span>
        ) : (
          info.summary ?? hint
        )
      }
    >
      <Input
        value={value}
        onChange={(e) => {
          const gstin = cleanGstin(e.target.value);
          onChange(gstin, gstinInfo(gstin));
        }}
        maxLength={15}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        className="font-mono uppercase"
      />
    </Field>
  );
}
