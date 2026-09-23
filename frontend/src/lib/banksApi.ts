import { apiGet } from '@/lib/api';

export interface ApiBank {
  id: string;
  name: string;
  is_active: boolean;
}

export async function fetchBanks(): Promise<ApiBank[]> {
  return apiGet<ApiBank[]>('/core/banks/');
}
