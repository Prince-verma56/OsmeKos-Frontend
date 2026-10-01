export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");

const STOREFRONT = `${API_URL}/storefront`;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Envelope<T> = { success: boolean; message: string; data: T };

async function unwrap<T>(res: Response): Promise<T> {
  let body: Partial<Envelope<T>> & { message?: string } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new ApiError(body.message ?? `The shop is not reachable right now (${res.status})`, res.status);
  }
  return body.data as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${STOREFRONT}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  return unwrap<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${STOREFRONT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
