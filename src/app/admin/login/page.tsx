'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Input, Field, Spinner } from '@/components/ui';
import { Logo, Monogram } from '@/components/Brand';

const DEV = process.env.NODE_ENV === 'development';
const DEV_EMAIL = DEV ? (process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL ?? '') : '';
const DEV_PASSWORD = DEV ? (process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? '') : '';

export default function LoginPage() {
  const { login, admin, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && admin) router.replace('/admin');
  }, [loading, admin, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="theme-espresso flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="theme-espresso grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 25%, rgb(184 137 62 / 0.35), transparent 45%), radial-gradient(circle at 75% 80%, rgb(245 239 230 / 0.10), transparent 50%)',
          }}
        />
        <div aria-hidden className="absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.07]">
          <Monogram className="h-160 w-auto" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo variant="inline" className="text-primary-foreground [&_span]:text-primary-foreground [&_sup]:text-primary-foreground/60 [&_svg]:text-primary-foreground" />
          <div className="max-w-md">
            <div className="caps-label text-primary-foreground/60">Skincare essentials</div>
            <p className="mt-4 font-display text-4xl font-normal leading-tight tracking-wide">
              Skincare that feels right.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
              Orders, stock, batches and accounts for OsmeKos — one calm place for the whole back office.
            </p>
            <span className="hairline mt-8" aria-hidden />
          </div>
          <p className="text-xs text-primary-foreground/50">Osmekos Essentials Pvt. Ltd. · New Delhi</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center text-center">
            <Logo variant="stacked" />
            <div className="caps-label mt-4">Skincare essentials</div>
          </div>

          <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-7">
            <h1 className="font-display text-xl font-medium tracking-wide text-foreground">Sign in</h1>
            <span className="hairline mt-2.5" aria-hidden />
            <p className="mb-5 mt-3 text-sm text-muted-foreground">Use the email and password your admin gave you.</p>

            <div className="space-y-4">
              <Field label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@osmekos.com"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </Field>

              <Field label="Password" required>
                <div className="relative">
                  <Input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {show ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </Field>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy} className="mt-6 w-full">
              {busy && <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Forgot your password? Ask an owner to reset it from Settings → Staff.
          </p>
        </div>
      </main>
    </div>
  );
}
