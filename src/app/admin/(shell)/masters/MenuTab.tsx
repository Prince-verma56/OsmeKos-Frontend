'use client';

import { useEffect, useState } from 'react';
import { Button, Card, ErrorBox, Loading } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { NAV } from '@/lib/nav';
import { loadHiddenMenu, saveHiddenMenu } from '@/lib/menuVisibility';

const GROUPS = NAV.map((g) => ({
  group: g.group || 'Home',
  items: g.items.filter((i) => !i.soon),
})).filter((g) => g.items.length > 0);

export function MenuTab({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [hidden, setHidden] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let dropped = false;
    loadHiddenMenu(true).then((saved) => {
      if (!dropped) setHidden(saved);
    });
    return () => {
      dropped = true;
    };
  }, []);

  async function save(next: string[]) {
    const previous = hidden ?? [];
    setHidden(next);
    setSaving(true);
    setError('');
    try {
      await saveHiddenMenu(next);
      toast.success('Menu updated');
    } catch (err) {
      setHidden(previous);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const toggle = (href: string, show: boolean) =>
    save(show ? (hidden ?? []).filter((h) => h !== href) : [...(hidden ?? []), href]);

  return (
    <Card
      title="What the menu shows"
      action={
        hidden && hidden.length > 0 ? (
          <Button size="sm" disabled={!canWrite || saving} onClick={() => save([])}>
            Show everything
          </Button>
        ) : null
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Untick a page to take it out of the sidebar and out of the New menu. Nothing is deleted —
        the page still works for anyone who has its web address or a link to it, and ticking it
        again brings it straight back. This is for the whole organization, not one person.
      </p>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      {!hidden ? (
        <Loading />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <div className="caps-label mb-1.5 text-[10px] text-muted-foreground">{g.group}</div>
              <ul className="space-y-1">
                {g.items.map((item) => {
                  const shown = !hidden.includes(item.href);
                  return (
                    <li key={item.href}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={shown}
                          disabled={!canWrite || saving}
                          onChange={(e) => toggle(item.href, e.target.checked)}
                        />
                        <span className={shown ? 'text-foreground' : 'text-muted-foreground line-through'}>
                          {item.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
