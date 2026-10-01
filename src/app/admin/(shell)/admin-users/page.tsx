'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, dateTime, errorMessage, type Paged } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { FileUpload } from '@/components/FileUpload';
import {
  Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Loading,
  PageHeader, Select, Spinner, Table, Td, Th,
} from '@/components/ui';

import { CardList, RecordCard } from '@/components/CardList';
type Role = { id: string; name: string; slug: string };

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: Role | null;
  invitedBy: { id: string; name: string; email: string } | null;
};

type Mode = 'closed' | 'create' | 'edit' | 'password';

type FormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
  avatarUrl: string;
  roleId: string;
  isActive: boolean;
};

const blank = (): FormState => ({
  name: '', email: '', password: '', phone: '', avatarUrl: '', roleId: '', isActive: true,
});

function passwordProblem(value: string) {
  if (value.length < 8) return 'At least 8 characters';
  if (!/[a-z]/.test(value)) return 'Needs a lowercase letter';
  if (!/[A-Z]/.test(value)) return 'Needs an uppercase letter';
  if (!/\d/.test(value)) return 'Needs a number';
  return '';
}

export default function AdminUsersPage() {
  const toast = useToast();
  const { admin: me } = useAuth();

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [mode, setMode] = useState<Mode>('closed');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [form, setFormState] = useState<FormState>(blank());
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const set = (patch: Partial<FormState>) => setFormState((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<Paged<AdminUser>>('/admin-users', {
        limit: 100,
        search: search || undefined,
        roleId: roleFilter || undefined,
        isActive: activeFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
      setRows(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await api.get<Paged<Role>>('/roles', { limit: 100 });
      setRoles(res.data);
    } catch {
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const t = setTimeout(loadRoles, 0);
    return () => clearTimeout(t);
  }, [loadRoles]);

  function startCreate() {
    setMode('create');
    setTargetId('');
    setFormState(blank());
    setFormError('');
  }

  function startEdit(u: AdminUser) {
    setMode('edit');
    setTargetId(u.id);
    setTargetName(u.name);
    setFormState({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone ?? '',
      avatarUrl: u.avatarUrl ?? '',
      roleId: u.role?.id ?? '',
      isActive: u.isActive,
    });
    setFormError('');
  }

  function startPassword(u: AdminUser) {
    setMode('password');
    setTargetId(u.id);
    setTargetName(u.name);
    setNewPassword('');
    setFormError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (mode === 'create') {
      const problem = passwordProblem(form.password);
      if (problem) {
        setFormError(problem);
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await api.post('/admin-users', {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          avatarUrl: form.avatarUrl.trim() || undefined,
          roleId: form.roleId || undefined,
          isActive: form.isActive,
        });
        toast.success(`${form.name.trim()} can now sign in`);
      } else {
        await api.patch(`/admin-users/${targetId}`, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          avatarUrl: form.avatarUrl.trim() || undefined,
          roleId: form.roleId || null,
          isActive: form.isActive,
        });
        toast.success(`${form.name.trim()} updated`);
      }
      setMode('closed');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(newPassword);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.post(`/admin-users/${targetId}/reset-password`, { newPassword });
      toast.success(`Password reset for ${targetName}`);
      setMode('closed');
      setNewPassword('');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Remove ${u.name} (${u.email})? They will lose access immediately.`)) return;
    setBusyId(u.id);
    setError('');
    try {
      await api.del(`/admin-users/${u.id}`);
      if (targetId === u.id) setMode('closed');
      toast.success(`${u.name} removed`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  const editingSelf = targetId === me?.id;

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Who can sign in to this admin, and what they are allowed to do"
        actions={
          <Button variant="primary" onClick={startCreate}>
            + New staff member
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <Card padded={false}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="">Active and inactive</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </Select>
              <span className="ml-auto text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? 'person' : 'people'}
              </span>
            </div>

            {loading ? (
              <Loading label="Loading staff…" />
            ) : (
              <>
              <CardList empty="No staff members match">
                {rows.map((u) => (
                  <RecordCard
                    key={u.id}
                    mono={false}
                    title={u.id === me?.id ? `${u.name} (you)` : u.name}
                    date={`Last signed in ${u.lastLoginAt ? dateTime(u.lastLoginAt) : 'never'}`}
                    primary={u.email}
                    secondary={u.role ? u.role.name : 'No role'}
                    thumb={
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                          bg-muted text-xs font-semibold text-muted-foreground
"
                      >
                        {u.name.slice(0, 1).toUpperCase()}
                      </span>
                    }
                    badges={
                      <Badge tone={u.isActive ? 'green' : 'gray'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    }
                    actions={
                      <>
                        <Button size="sm" onClick={() => startEdit(u)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startPassword(u)}>
                          Password
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === u.id || u.id === me?.id}
                          onClick={() => remove(u)}
                        >
                          Remove
                        </Button>
                      </>
                    }
                  />
                ))}
              </CardList>

              <div className="hidden md:block">
              <Table minWidth="560px">
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <EmptyRow colSpan={4} message="No staff members match" />}
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                              bg-muted text-xs font-semibold text-muted-foreground
"
                          >
                            {u.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 max-w-[150px] 2xl:max-w-[220px]">
                            <div className="font-medium text-foreground">
                              {u.name}
                              {u.id === me?.id && (
                                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                  you
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-xs">
                        {u.role ? u.role.name : <span className="text-muted-foreground">No role</span>}
                      </Td>
                      <Td>
                        <Badge tone={u.isActive ? 'green' : 'gray'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {u.lastLoginAt ? `Last signed in ${dateTime(u.lastLoginAt)}` : 'Never signed in'}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => startEdit(u)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startPassword(u)}>
                            Password
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === u.id || u.id === me?.id}
                            onClick={() => remove(u)}
                          >
                            Remove
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              </div>
              </>
            )}
          </Card>

          <p className="mt-3 text-xs text-muted-foreground">
            A staff member without a role can sign in but sees nothing — the role is what grants
            access. You cannot deactivate, re-role or remove your own account, and the last active
            Owner / Admin cannot be removed.
          </p>
        </div>

        <div>
          {mode === 'closed' && (
            <Card title="Access">
              <p className="text-sm text-muted-foreground">
                Every person who signs in needs their own account. Sharing one login means the
                activity trail on orders, stock moves and payments names the wrong person.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Set what they can do by assigning a role. Roles are managed on the{' '}
                <a href="/admin/roles" className="underline underline-offset-2">
                  Roles
                </a>{' '}
                page.
              </p>
              <div className="mt-3">
                <Button variant="primary" onClick={startCreate}>
                  + New staff member
                </Button>
              </div>
            </Card>
          )}

          {mode === 'password' && (
            <Card title={`Reset password — ${targetName}`}>
              {formError && (
                <div className="mb-4">
                  <ErrorBox message={formError} />
                </div>
              )}
              <form onSubmit={resetPassword} className="space-y-4">
                <Field
                  label="New password"
                  required
                  hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number"
                >
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Tell them the new password over a channel they already trust, and ask them to
                  change it once they are in.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving && <Spinner className="border-card/40 border-t-card" />}
                    Reset password
                  </Button>
                  <Button type="button" onClick={() => setMode('closed')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <Card title={mode === 'create' ? 'New staff member' : `Edit ${targetName}`}>
              {formError && (
                <div className="mb-4">
                  <ErrorBox message={formError} />
                </div>
              )}
              <form onSubmit={save} className="space-y-4">
                <Field label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Sunil Kumar"
                    required
                  />
                </Field>

                <Field
                  label="Email"
                  required={mode === 'create'}
                  hint={mode === 'edit' ? 'Email cannot be changed after the account is made' : undefined}
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                    placeholder="name@osmekos.com"
                    disabled={mode === 'edit'}
                    required={mode === 'create'}
                  />
                </Field>

                {mode === 'create' && (
                  <Field
                    label="Password"
                    required
                    hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number"
                  >
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => set({ password: e.target.value })}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                )}

                <Field label="Phone">
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 16) })}
                    placeholder="98765 43210"
                  />
                </Field>

                <Field label="Role" hint="Without one they can sign in but see nothing">
                  <Select
                    value={form.roleId}
                    onChange={(e) => set({ roleId: e.target.value })}
                    className="w-full"
                    disabled={editingSelf}
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Photo">
                  <div className="flex items-center gap-3">
                    {form.avatarUrl ? (
                      <img
                        src={form.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full
                          bg-muted text-sm font-semibold text-muted-foreground
"
                      >
                        {(form.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <FileUpload
                      label={form.avatarUrl ? 'Replace' : 'Upload'}
                      onUploaded={(files) => files[0] && set({ avatarUrl: files[0].url })}
                    />
                    {form.avatarUrl && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => set({ avatarUrl: '' })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </Field>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set({ isActive: e.target.checked })}
                    disabled={editingSelf}
                  />
                  Active — can sign in
                </label>
                {editingSelf && (
                  <p className="text-xs text-muted-foreground">
                    You cannot change your own role or deactivate yourself. Ask another Owner / Admin.
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving && <Spinner className="border-card/40 border-t-card" />}
                    {mode === 'create' ? 'Create user' : 'Save changes'}
                  </Button>
                  <Button type="button" onClick={() => setMode('closed')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
