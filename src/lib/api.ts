import { formatDate, formatDateTime, formatMoney } from './formatPrefs';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const API_BASE = BASE;

const ACCESS_KEY = 'osmekos.accessToken';
const SESSION_KEY = 'osmekos.hasSession';

export type ApiError = {
  status: number;
  message: string;
  details?: { field: string; message: string; received?: string; hint?: string }[];
};

export type Paged<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    [key: string]: unknown;
  };
};

export const tokens = {
  get access() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  set(access: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(SESSION_KEY, '1');
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(SESSION_KEY);
  },
  get hasSession() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SESSION_KEY) === '1';
  },
};

export function authHeader(): Record<string, string> {
  return tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {};
}

let refreshing: Promise<boolean> | null = null;

const REFRESH_LOCK = 'osmekos.token-refresh';

async function refreshAccessToken(staleAccess: string | null): Promise<boolean> {
  const run = async () => {
    if (tokens.access && tokens.access !== staleAccess) return true;
    const res = await fetch(`${BASE}/auth/admin/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return !!tokens.access && tokens.access !== staleAccess;
    const json = await res.json();
    tokens.set(json.data.accessToken);
    return true;
  };

  refreshing ??= (async () => {
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      return locks ? await locks.request(REFRESH_LOCK, run) : await run();
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();

  return refreshing;
}

export const restoreSession = () => (tokens.hasSession ? refreshAccessToken(null) : Promise.resolve(false));

type Options = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  noAuth?: boolean;
};

async function request<T>(path: string, opts: Options = {}, isRetry = false): Promise<T> {
  const url = new URL(BASE + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  const sentAccess = opts.noAuth ? null : tokens.access;
  if (sentAccess) headers.Authorization = `Bearer ${sentAccess}`;

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
    credentials: 'include',
  });

  if (res.status === 401 && !isRetry && !opts.noAuth && sentAccess) {
    if (await refreshAccessToken(sentAccess)) return request<T>(path, opts, true);
    tokens.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = new URL('/admin/login', window.location.origin).toString();
    }
  }

  const json = await res.json().catch(() => ({ message: res.statusText }));

  if (!res.ok || json.success === false) {
    const err: ApiError = {
      status: res.status,
      message: json.message ?? 'Request failed',
      details: json.details,
    };
    throw err;
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Options['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, opts?: Options) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};

export function errorMessage(err: unknown): string {
  const e = err as ApiError;
  if (!e?.message) return 'Something went wrong';
  if (e.details?.length) {
    return e.details.map((d) => `${d.field}: ${d.message}`).join(' · ');
  }
  return e.message;
}

export const money = (v: unknown) => formatMoney(v);

export const shortDate = (v?: string | null) => formatDate(v);

export const dateTime = (v?: string | null) => formatDateTime(v);

export { currencySymbol, numberLocale, todayIso, setFormatPrefs } from './formatPrefs';
