const API = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : code);
    this.name = "ApiError";
  }
}

export type CsrfResponse = {
  csrf_token: string;
};

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function requestCsrfToken(): Promise<string> {
  const response = await api<CsrfResponse>("/auth/csrf");
  setCsrfToken(response.csrf_token);
  return response.csrf_token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isUnsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (isUnsafeMethod && csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    method,
    credentials: init.credentials ?? "same-origin",
    headers,
  });

  if (!response.ok) {
    let payload: { code?: string; detail?: unknown } = {};

    try {
      payload = await response.json();
    } catch {
      // The server may return an empty or non-JSON error response.
    }

    throw new ApiError(
      response.status,
      payload.code ?? "http_error",
      payload.detail ?? response.statusText,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
