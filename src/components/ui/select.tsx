'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { SearchSelect, type SearchOption } from '../SearchSelect';

const hasWidth = (c: string) => /(^|\s)(w-|min-w-|max-w-|flex-1)/.test(c);

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

type OptionProps = { value?: string | number; children?: React.ReactNode; disabled?: boolean; hidden?: boolean };
type GroupProps = { label?: string; children?: React.ReactNode };

function collectOptions(children: React.ReactNode, group?: string, out: SearchOption[] = []): SearchOption[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collectOptions((child.props as { children?: React.ReactNode }).children, group, out);
      return;
    }
    if (child.type === 'optgroup') {
      const props = child.props as GroupProps;
      collectOptions(props.children, props.label, out);
      return;
    }
    if (child.type === 'option') {
      const props = child.props as OptionProps;
      if (props.hidden) return;
      const label = textOf(props.children).replace(/\s+/g, ' ').trim();
      out.push({
        value: props.value === undefined ? label : String(props.value),
        label: label || '—',
        group,
        disabled: props.disabled,
      });
    }
  });
  return out;
}

const WRAPPER_CLASS = /^(?:[a-z0-9]+:)*(?:w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-span|row-span|self-|order-|m[trblxy]?-|-m[trblxy]?-|hidden$|block$|inline|sr-only)/;

function splitClasses(className: string) {
  const wrapper: string[] = [];
  const trigger: string[] = [];
  for (const c of className.split(/\s+/).filter(Boolean)) {
    if (WRAPPER_CLASS.test(c)) wrapper.push(c);
    else trigger.push(c);
  }
  return { wrapper: wrapper.join(' '), trigger: trigger.join(' ') };
}

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value?: string | number | readonly string[];
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

export function Select({
  value,
  onChange,
  children,
  className = '',
  disabled,
  required,
  name,
  id,
  title,
  'aria-label': ariaLabel,
}: SelectProps) {
  const options = React.useMemo(() => collectOptions(children), [children]);
  const current = value === undefined || value === null ? '' : String(value);
  const { wrapper, trigger } = splitClasses(className);
  const sized = hasWidth(className);
  const longest = options.reduce((n, o) => Math.max(n, o.label.length), 0);
  const empty = options.find((o) => o.value === '');

  return (
    <SearchSelect
      value={current}
      options={options}
      placeholder={empty?.label ?? 'Select'}
      onChange={(next) => {
        if (!onChange) return;
        const target = { value: next, name: name ?? '' } as HTMLSelectElement;
        onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={disabled}
      required={required}
      name={name}
      id={id}
      ariaLabel={ariaLabel ?? title}
      className={cn('inline-block max-w-full align-middle', wrapper)}
      triggerClassName={trigger}
      style={sized ? undefined : { width: `min(calc(${Math.min(Math.max(longest, 6), 32)}ch + 3rem), 100%)` }}
    />
  );
}
