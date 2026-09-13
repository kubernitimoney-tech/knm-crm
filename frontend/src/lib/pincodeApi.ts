import { apiGet } from '@/lib/api';
import { digitsOnly } from '@/lib/indiaValidators';

export interface PincodeDetails {
  pincode: string;
  city: string;
  state: string;
}

export async function fetchPincodeDetails(pincode: string): Promise<PincodeDetails> {
  const normalized = digitsOnly(pincode, 6);
  return apiGet<PincodeDetails>(`/core/pincode/${normalized}/`);
}
