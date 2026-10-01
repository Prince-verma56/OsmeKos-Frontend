export type CategoryRef = {
  id: string;
  name: string;
  parentId?: string | null;
  path?: string | null;
};

export function categoryLabel(all: CategoryRef[], c: CategoryRef): string {
  const byId = new Map(all.map((x) => [x.id, x]));
  const parts = [c.name];
  const seen = new Set([c.id]);

  let cur = c.parentId ?? null;
  while (cur && byId.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    const parent = byId.get(cur)!;
    parts.unshift(parent.name);
    cur = parent.parentId ?? null;
  }
  return parts.join(' › ');
}

export function sortForPicker<T extends CategoryRef & { position?: number }>(rows: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const c of rows) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
  }

  const known = new Set(rows.map((r) => r.id));
  const out: T[] = [];
  const walk = (parentId: string | null) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(null);
  for (const c of rows) if (c.parentId && !known.has(c.parentId)) out.push(c);
  return out;
}
