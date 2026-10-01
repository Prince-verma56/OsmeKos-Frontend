'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { DatePicker } from './date-picker';

export const inputClass =
  'h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/25 file:border-0 file:bg-transparent file:text-sm file:font-medium';

const hasWidth = (c: string) => /(^|\s)(w-|min-w-|max-w-|flex-1)/.test(c);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    if (props.type === 'date') {
      const { value, onChange, min, max, disabled, required, name, id, placeholder } = props;
      return (
        <DatePicker
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(next) => {
            if (!onChange) return;
            const target = { value: next, name: name ?? '' } as HTMLInputElement;
            onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>);
          }}
          min={min === undefined ? undefined : String(min)}
          max={max === undefined ? undefined : String(max)}
          disabled={disabled}
          required={required}
          name={name}
          id={id}
          placeholder={placeholder}
          aria-label={props['aria-label']}
          className={hasWidth(className) ? className.split(/\s+/).filter((c) => /^(?:[a-z0-9]+:)*(?:w-|min-w-|max-w-|flex-)/.test(c)).join(' ') : undefined}
        />
      );
    }
    return <input ref={ref} className={cn(inputClass, hasWidth(className) ? '' : 'w-full', className)} {...props} />;
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(inputClass, 'h-auto min-h-20 w-full py-2 leading-relaxed', className)}
        autoComplete="off"
        {...props}
      />
    );
  }
);

export { Select } from './select';
