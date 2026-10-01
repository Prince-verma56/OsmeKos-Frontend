'use client';

import { useRef, useState } from 'react';
import { API_BASE, authHeader } from '@/lib/api';
import { Button } from './ui';

export type Uploaded = {
  url: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
};

export function FileUpload({
  onUploaded,
  accept = 'image/*',
  label = 'Upload',
  disabled = false,
  multiple = false,
}: {
  onUploaded: (files: Uploaded[]) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(files: FileList) {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      if (multiple) {
        for (const f of Array.from(files).slice(0, 10)) body.append('files', f);
      } else {
        body.append('file', files[0]);
      }

      const res = await fetch(`${API_BASE}/uploads${multiple ? '/many' : ''}`, {
        method: 'POST',
        headers: authHeader(),
        body,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? `Upload failed (${res.status})`);

      const data = json.data;
      onUploaded(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) send(e.target.files);
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : label}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
