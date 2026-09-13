import { apiGet } from '@/lib/api';
import { upperAlphanumeric } from '@/lib/indiaValidators';

export interface IfscDetails {
  ifsc_code: string;
  bank_name: string;
  branch: string;
  city: string;
  state: string;
}

export async function fetchIfscDetails(ifscCode: string): Promise<IfscDetails> {
  const normalized = upperAlphanumeric(ifscCode, 11);
  return apiGet<IfscDetails>(`/core/ifsc/${normalized}/`);
}
