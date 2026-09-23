const PINCODE_API_URL = 'https://api.postalpincode.in/pincode/{pincode}';

export interface PincodeDetails {
  pincode: string;
  city: string;
  state: string;
}

export class PincodeLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PincodeLookupError';
  }
}

export function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

function pickPostOffice(postOffices: Array<Record<string, string>>) {
  for (const entry of postOffices) {
    if (entry.BranchType === 'Head Post Office') return entry;
  }
  for (const entry of postOffices) {
    if (entry.DeliveryStatus === 'Delivery') return entry;
  }
  return postOffices[0];
}

export async function fetchPincodeDetails(pincode: string): Promise<PincodeDetails> {
  const normalized = digitsOnly(pincode, 6);
  if (normalized.length !== 6) {
    throw new PincodeLookupError('Enter a valid 6-digit PIN code.');
  }

  const response = await fetch(PINCODE_API_URL.replace('{pincode}', normalized), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new PincodeLookupError('Unable to reach pincode service.');
  }

  const payload = (await response.json()) as Array<{
    Status?: string;
    PostOffice?: Array<Record<string, string>>;
  }>;

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new PincodeLookupError('Invalid pincode service response.');
  }

  const result = payload[0];
  if (result.Status !== 'Success') {
    throw new PincodeLookupError('PIN code not found.');
  }

  const postOffices = result.PostOffice ?? [];
  if (postOffices.length === 0) {
    throw new PincodeLookupError('PIN code not found.');
  }

  const selected = pickPostOffice(postOffices);
  const city = (selected.District || selected.Name || '').trim();
  const state = (selected.State || '').trim();

  if (!city || !state) {
    throw new PincodeLookupError('Incomplete details for this PIN code.');
  }

  return { pincode: normalized, city, state };
}
