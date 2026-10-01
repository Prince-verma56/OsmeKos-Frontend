'use client';

import { useState } from 'react';
import { Button, Card, Input } from './ui';
import { FileUpload } from './FileUpload';

export type MediaType = 'IMAGE' | 'VIDEO';

export type MediaDraft = {
  url: string;
  type: MediaType;
  alt: string;
  variantId?: string | null;
};

const TYPE_LABEL: Record<MediaType, string> = {
  IMAGE: 'Image',
  VIDEO: 'Video',
};

const isImage = (m: MediaDraft) => m.type === 'IMAGE';

export function MediaEditor({
  media,
  onChange,
}: {
  media: MediaDraft[];
  onChange: (next: MediaDraft[]) => void;
}) {
  const [error, setError] = useState('');

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <Card
      title="Media"
      action={
        <span className="text-xs text-muted-foreground">
          {media.length}/50
        </span>
      }
    >
      {media.length > 0 && (
        <ul className="mb-4 space-y-2">
          {media.map((m, i) => (
            <li
              key={m.url}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {isImage(m) ? (
                  <img
                    src={m.url}
                    alt={m.alt || 'Product media'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.setAttribute('data-broken', 'true');
                    }}
                  />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {m.type === 'VIDEO' ? 'VIDEO' : '3D'}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {TYPE_LABEL[m.type]}
                  </span>
                  {i === 0 && (
                    <span className="text-xs text-muted-foreground">cover</span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.url}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    value={m.alt}
                    onChange={(e) =>
                      onChange(media.map((x, idx) => (idx === i ? { ...x, alt: e.target.value } : x)))
                    }
                    placeholder="Alt text"
                    className="h-7 min-w-[180px] flex-1 text-xs"
                  />
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button type="button" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={i === media.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => onChange(media.filter((_, idx) => idx !== i))}
                >
                  ×
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FileUpload
        label="Upload"
        accept="image/*,video/*"
        multiple
        onUploaded={(files) => {
          const fresh = files
            .filter((f) => !media.some((m) => m.url === f.url))
            .map((f) => ({
              url: f.url,
              type: (f.isImage ? 'IMAGE' : 'VIDEO') as MediaType,
              alt: '',
            }));
          onChange([...media, ...fresh].slice(0, 50));
          setError('');
        }}
      />

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <p className="mt-3 text-xs text-muted-foreground">
        The first item is the cover image, and these shots stand for the product as a whole.
        A variant&apos;s own picture is set on the variant &mdash; that is the one invoices,
        challans and credit notes print. Images are capped at 5 MB each.
      </p>
    </Card>
  );
}
