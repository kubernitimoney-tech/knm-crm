import axios, { AxiosError } from 'axios';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  LeadIntakePayload,
  LeadIntakeResponseData,
  LeadSource,
  TrackApplicationsPayload,
  TrackApplicationsResponse,
} from '@/types/lead';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

export class LeadApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'LeadApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function flattenErrors(errors: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(errors)) {
    const fieldKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fieldKey] = value;
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      result[fieldKey] = value[0];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenErrors(value as Record<string, unknown>, fieldKey));
    }
  }

  return result;
}

function parseApiError(error: unknown): LeadApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const status = axiosError.response?.status ?? 0;
    const data = axiosError.response?.data;

    if (status === 429) {
      return new LeadApiError(
        'You have submitted too many applications recently. Please try again after an hour.',
        429,
      );
    }

    const message = data?.message || 'Something went wrong. Please try again.';
    const fieldErrors = data?.errors ? flattenErrors(data.errors) : {};
    return new LeadApiError(message, status, fieldErrors);
  }

  return new LeadApiError('Network error. Please check your connection and try again.', 0);
}

export async function submitLead(payload: LeadIntakePayload): Promise<LeadIntakeResponseData> {
  try {
    const response = await api.post<ApiSuccessResponse<LeadIntakeResponseData>>(
      '/leads/intake/',
      { ...payload, source_slug: 'website' },
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

export async function fetchLeadSources(): Promise<LeadSource[]> {
  try {
    const response = await api.get<ApiSuccessResponse<LeadSource[]>>('/leads/intake/sources/');
    return response.data.data;
  } catch {
    return [];
  }
}

export async function trackApplications(
  payload: TrackApplicationsPayload,
): Promise<TrackApplicationsResponse> {
  try {
    const response = await api.post<ApiSuccessResponse<TrackApplicationsResponse>>(
      '/leads/intake/track/',
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}
