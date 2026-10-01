'use client';

import { useState } from 'react';

const splitTags = (value: string) =>
  value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export function TagInput({
  value,
  onChange,
  placeholder = 'Type a tag and press Enter',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const tags = splitTags(value);

  const commit = (text: string) => {
    const fresh = splitTags(text).filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
    if (fresh.length) onChange([...tags, ...fresh].join(', '));
    setDraft('');
  };

  return (
    <div
      className="flex min-h-[34px] w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1
        focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20
"
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t).join(', '))}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove tag ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          if (e.target.value.includes(',')) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1).join(', '));
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={tags.length ? '' : placeholder}
        aria-label="Add a tag"
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
