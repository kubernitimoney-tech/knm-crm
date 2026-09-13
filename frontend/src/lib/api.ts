import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiEnvelope, AuthTokens } from '@/types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'lms_tokens';

export function getStoredTokens(): AuthTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: AuthTokens | null): void {
  if (tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiRequestError extends Error {
  errors: Record<string, unknown> | unknown[];

  constructor(message: string, errors: Record<string, unknown> | unknown[] = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.errors = errors;
  }
}

function formatFieldErrors(errors: Record<string, unknown> | unknown[]): string {
  if (Array.isArray(errors)) {
    return errors.map(String).join('; ');
  }
  const parts: string[] = [];
  for (const [field, value] of Object.entries(errors)) {
    if (field === 'detail') continue;
    const msgs = Array.isArray(value) ? value.map(String) : [String(value)];
    parts.push(`${field}: ${msgs.join(', ')}`);
  }
  return parts.join('; ');
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const detail = formatFieldErrors(error.errors);
    return detail ? `${error.message} (${detail})` : error.message;
  }
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiEnvelope<unknown> & {
      errors?: Record<string, unknown> | unknown[];
    };
    if (body && typeof body === 'object' && body.success === false) {
      const detail = body.errors ? formatFieldErrors(body.errors) : '';
      const message = body.message || 'Request failed';
      return detail ? `${message} (${detail})` : message;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function unwrapEnvelope<T>(response: { data: ApiEnvelope<T> }): T {
  const { data } = response;
  if (!data.success) {
    throw new ApiRequestError(data.message || 'Request failed', (data as ApiEnvelope<T> & { errors?: Record<string, unknown> }).errors ?? {});
  }
  return data.data;
}

async function callApi<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise;
    return unwrapEnvelope(response);
  } catch (error) {
    if (error instanceof AxiosError) {
      const body = error.response?.data as ApiEnvelope<T> & {
        errors?: Record<string, unknown> | unknown[];
      };
      if (body && typeof body === 'object' && body.success === false) {
        throw new ApiRequestError(body.message || 'Request failed', body.errors ?? {});
      }
    }
    throw error;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getStoredTokens();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});


function isSessionInvalidatedError(error: AxiosError): boolean {
  const body = error.response?.data;
  if (!body || typeof body !== 'object') return false;
  const message =
    'message' in body && typeof body.message === 'string'
      ? body.message
      : 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : '';
  return message.toLowerCase().includes('session invalidated');
}

let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshAccessToken(): Promise<AuthTokens | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const tokens = getStoredTokens();
    if (!tokens?.refresh) return null;

    try {
      const { data } = await axios.post<ApiEnvelope<{ tokens: AuthTokens }>>(
        `${API_BASE_URL}/auth/refresh/`,
        { refresh: tokens.refresh },
      );
      if (data.success && data.data.tokens) {
        setStoredTokens(data.data.tokens);
        return data.data.tokens;
      }
    } catch {
      return null;
    }
    return null;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      if (isSessionInvalidatedError(error)) {
        setStoredTokens(null);
        window.dispatchEvent(
          new CustomEvent('auth:logout', { detail: { reason: 'replaced' } }),
        );
        return Promise.reject(error);
      }

      original._retry = true;
      const newTokens = await refreshAccessToken();
      if (newTokens?.access) {
        original.headers.Authorization = `Bearer ${newTokens.access}`;
        return api(original);
      }
      setStoredTokens(null);
      window.dispatchEvent(
        new CustomEvent('auth:logout', {
          detail: {
            reason: isSessionInvalidatedError(error) ? 'replaced' : 'expired',
          },
        }),
      );
    }
    return Promise.reject(error);
  },
);

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return callApi(api.post<ApiEnvelope<T>>(url, body));
}

export async function apiGet<T>(url: string): Promise<T> {
  return callApi(api.get<ApiEnvelope<T>>(url));
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return callApi(api.patch<ApiEnvelope<T>>(url, body));
}

export async function apiDelete<T>(url: string): Promise<T> {
  return callApi(api.delete<ApiEnvelope<T>>(url));
}

export async function apiPatchForm<T>(url: string, formData: FormData): Promise<T> {
  return callApi(
    api.patch<ApiEnvelope<T>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

export async function apiPostForm<T>(url: string, formData: FormData): Promise<T> {
  return callApi(
    api.post<ApiEnvelope<T>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}
