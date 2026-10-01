'use client';

import { useState } from 'react';
import { Button, Input, Select } from './ui';

export function ComboSelect({
  value,
  options,
  onChange,
  placeholder = 'Not set',
  addLabel = '+ Add new…',
  newPlaceholder = 'Type a new value',
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  addLabel?: string;
  newPlaceholder?: string;
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={newPlaceholder}
          autoFocus
        />
        <Button
          type="button"
          onClick={() => {
            setAdding(false);
            onChange('');
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  const opts = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <Select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__new__') {
          setAdding(true);
          onChange('');
          return;
        }
        onChange(e.target.value);
      }}
      className="w-full"
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value="__new__">{addLabel}</option>
    </Select>
  );
}
