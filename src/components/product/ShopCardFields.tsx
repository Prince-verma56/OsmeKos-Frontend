'use client';

import { Button, Field, Input } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import type { MediaDraft } from '@/components/MediaEditor';

export const CARD_SLOTS = ['Card image', 'Hover image'] as const;

function Slot({
  label,
  hint,
  url,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  url: string;
  onPick: (url: string) => void;
  onClear: () => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Empty</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <FileUpload label={url ? 'Replace' : 'Upload'} accept="image/*" onUploaded={(files) => files[0] && onPick(files[0].url)} />
          {url && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}

export function ShopCardFields({
  subtitle,
  onSubtitle,
  media,
  onMedia,
}: {
  subtitle: string;
  onSubtitle: (value: string) => void;
  media: MediaDraft[];
  onMedia: (next: MediaDraft[]) => void;
}) {
  const images = media.filter((m) => m.type === 'IMAGE');
  const rest = media.filter((m) => m.type !== 'IMAGE');

  const setSlot = (index: number, url: string | null) => {
    const next = [...images];
    while (next.length < index) next.push({ url: '', type: 'IMAGE', alt: '' });
    if (url === null) {
      next.splice(index, 1);
    } else if (next[index]) {
      next[index] = { ...next[index], url };
    } else {
      next.push({ url, type: 'IMAGE', alt: '' });
    }
    onMedia([...next.filter((m) => m.url), ...rest]);
  };

  return (
    <div className="space-y-4">
      <Field label="Tag line" hint='The line under the name on the shop card, e.g. "Triple Ceramide Complex + Niacinamide"'>
        <Input value={subtitle} onChange={(e) => onSubtitle(e.target.value)} placeholder="Triple Ceramide Complex + Niacinamide" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot
          label="Card image"
          hint="The first photo shoppers see"
          url={images[0]?.url ?? ''}
          onPick={(url) => setSlot(0, url)}
          onClear={() => setSlot(0, null)}
        />
        <Slot
          label="Hover image"
          hint="Fades in when the card is hovered"
          url={images[1]?.url ?? ''}
          onPick={(url) => setSlot(1, url)}
          onClear={() => setSlot(1, null)}
        />
      </div>
      {images.length > 2 && (
        <p className="text-xs text-muted-foreground">
          {images.length - 2} more {images.length - 2 === 1 ? 'photo sits' : 'photos sit'} behind these on the product page.
        </p>
      )}
    </div>
  );
}
