'use client';

import { Plus, X } from 'lucide-react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';

export type HowToStep = { title: string; text: string };

export type Story = { heading: string; body: string; image: string };

export function HowToUseSteps({ value, onChange }: { value: HowToStep[]; onChange: (next: HowToStep[]) => void }) {
  const update = (i: number, patch: Partial<HowToStep>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No steps yet. Without them the shop shows the standard three.
        </p>
      )}
      <ol className="space-y-2">
        {value.map((row, i) => (
          <li key={i} className="rounded-md border border-border bg-card p-2">
            <div className="flex items-center gap-2">
              <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <Input
                value={row.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Step, e.g. Apply"
                aria-label={`Step ${i + 1} name`}
                maxLength={40}
                className="min-w-0 flex-1"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label="Remove step"
              >
                <X strokeWidth={1.5} />
              </Button>
            </div>
            <Textarea
              rows={2}
              value={row.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="What to do, in one or two sentences"
              aria-label={`Step ${i + 1} text`}
              maxLength={300}
              className="mt-2"
            />
          </li>
        ))}
      </ol>
      <Button size="sm" onClick={() => onChange([...value, { title: '', text: '' }])} disabled={value.length >= 8}>
        <Plus /> Add step
      </Button>
    </div>
  );
}

export function StoryFields({ value, onChange }: { value: Story; onChange: (next: Story) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Heading" hint='Leave empty for "Honest by design."'>
        <Input
          value={value.heading}
          onChange={(e) => onChange({ ...value, heading: e.target.value })}
          placeholder="Honest by design."
          maxLength={80}
        />
      </Field>
      <Field label="Description" hint="The paragraph beside the photo. The bullet points come from the benefits above.">
        <Textarea
          rows={4}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          placeholder="Every bottle carries the full ingredient list, the concentration of each active, its batch number and best-before date."
          maxLength={1200}
        />
      </Field>
      <Field label="Photo" hint="Sits to the right of the text on the product page">
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {value.image ? (
              <img src={value.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Empty</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <FileUpload
              label={value.image ? 'Replace' : 'Upload'}
              accept="image/*"
              onUploaded={(files) => files[0] && onChange({ ...value, image: files[0].url })}
            />
            {value.image && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, image: '' })}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Field>
    </div>
  );
}
