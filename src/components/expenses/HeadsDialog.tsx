'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Modal } from '@/components/Modal';
import { Button, ErrorBox, Input, Spinner } from '@/components/ui';
import type { Head } from './ExpenseDialog';

export function HeadsDialog({
  heads,
  canWrite,
  canDelete,
  onClose,
  onChanged,
}: {
  heads: Head[];
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [newHead, setNewHead] = useState('');
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<Record<string, string>>({});

  async function run(key: string, work: () => Promise<unknown>, done: string) {
    setBusy(key);
    setError('');
    try {
      await work();
      toast.success(done);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  const addHead = () =>
    run('new-head', async () => {
      await api.post('/expenses/heads', { name: newHead.trim() });
      setNewHead('');
    }, 'Head added');

  const addSub = (headId: string) =>
    run(`sub-${headId}`, async () => {
      await api.post('/expenses/heads', { name: (newSub[headId] ?? '').trim(), parentId: headId });
      setNewSub((s) => ({ ...s, [headId]: '' }));
    }, 'Sub-head added');

  const rename = (id: string, name: string) =>
    run(`rename-${id}`, async () => {
      await api.patch(`/expenses/heads/${id}`, { name: name.trim() });
      setRenaming((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
    }, 'Renamed');

  const toggle = (id: string, isActive: boolean) =>
    run(`toggle-${id}`, () => api.patch(`/expenses/heads/${id}`, { isActive: !isActive }), isActive ? 'Switched off' : 'Switched on');

  const remove = (id: string, name: string) =>
    run(`del-${id}`, () => api.del(`/expenses/heads/${id}`), `${name} removed`);

  const Row = ({ item, isSub }: { item: { id: string; name: string; isActive: boolean }; isSub?: boolean }) => {
    const editing = renaming[item.id] !== undefined;
    return (
      <div className={`flex flex-wrap items-center gap-2 py-1.5 ${isSub ? 'pl-6' : ''}`}>
        {editing ? (
          <>
            <Input
              value={renaming[item.id]}
              onChange={(e) => setRenaming((r) => ({ ...r, [item.id]: e.target.value }))}
              className="min-w-0 flex-1 basis-40"
              aria-label={`New name for ${item.name}`}
            />
            <Button size="sm" variant="primary" onClick={() => rename(item.id, renaming[item.id])} disabled={busy === `rename-${item.id}`}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setRenaming((r) => {
                  const next = { ...r };
                  delete next[item.id];
                  return next;
                })
              }
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className={`min-w-0 flex-1 text-sm ${item.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
              {item.name}
            </span>
            {canWrite && (
              <>
                <button
                  onClick={() => setRenaming((r) => ({ ...r, [item.id]: item.name }))}
                  className="text-xs text-gold-ink hover:underline"
                >
                  Rename
                </button>
                <button
                  onClick={() => toggle(item.id, item.isActive)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={busy === `toggle-${item.id}`}
                >
                  {item.isActive ? 'Switch off' : 'Switch on'}
                </button>
              </>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(item.id, item.name)}
                disabled={busy === `del-${item.id}`}
                aria-label={`Remove ${item.name}`}
              >
                <X strokeWidth={1.5} />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Heads and sub-heads"
      description="How expenses are grouped. A head in use can be switched off but not deleted."
      footer={
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        {heads.map((head) => (
          <div key={head.id} className="rounded-md border border-border p-3">
            <Row item={head} />
            <div className="mt-1 border-t border-border pt-1">
              {head.children.map((child) => (
                <Row key={child.id} item={child} isSub />
              ))}
              {head.children.length === 0 && (
                <p className="py-1.5 pl-6 text-xs text-muted-foreground">No sub-heads yet</p>
              )}
              {canWrite && (
                <div className="mt-2 flex gap-2 pl-6">
                  <Input
                    value={newSub[head.id] ?? ''}
                    onChange={(e) => setNewSub((s) => ({ ...s, [head.id]: e.target.value }))}
                    placeholder={`New sub-head under ${head.name}`}
                    className="min-w-0 flex-1"
                    aria-label={`New sub-head under ${head.name}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addSub(head.id)}
                    disabled={!((newSub[head.id] ?? '').trim()) || busy === `sub-${head.id}`}
                  >
                    {busy === `sub-${head.id}` ? <Spinner /> : <Plus />}
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {canWrite && (
          <div className="flex gap-2 rounded-md border border-dashed border-border p-3">
            <Input
              value={newHead}
              onChange={(e) => setNewHead(e.target.value)}
              placeholder="New head, e.g. Rent"
              className="min-w-0 flex-1"
              aria-label="New head"
            />
            <Button size="sm" variant="primary" onClick={addHead} disabled={!newHead.trim() || busy === 'new-head'}>
              {busy === 'new-head' ? <Spinner className="border-card/40 border-t-card" /> : <Plus />}
              Add head
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
