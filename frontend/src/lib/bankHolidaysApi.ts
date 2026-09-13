import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

export interface ApiBankHoliday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  financial_year_start: number;
  financial_year_display: string;
  created_at: string;
  updated_at: string;
}

export interface BankHoliday {
  id: string;
  holidayDate: string;
  holidayName: string;
  financialYearStart: number;
  financialYearDisplay: string;
  addedOn: string;
}

export interface BankHolidayPayload {
  holiday_date: string;
  holiday_name: string;
  financial_year_start: number;
}

function mapBankHoliday(row: ApiBankHoliday): BankHoliday {
  const holidayDate = row.holiday_date.slice(0, 10);
  return {
    id: row.id,
    holidayDate,
    holidayName: row.holiday_name,
    financialYearStart: row.financial_year_start,
    financialYearDisplay: row.financial_year_display,
    addedOn: row.created_at,
  };
}

export async function fetchBankHolidays(params?: {
  financial_year?: number;
  search?: string;
}): Promise<BankHoliday[]> {
  const query = new URLSearchParams();
  if (params?.financial_year != null) {
    query.set('financial_year', String(params.financial_year));
  }
  if (params?.search) {
    query.set('search', params.search);
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const data = await apiGet<ApiBankHoliday[]>(`/organization/bank-holidays/${suffix}`);
  return data.map(mapBankHoliday);
}

export async function createBankHoliday(payload: BankHolidayPayload): Promise<BankHoliday> {
  const data = await apiPost<ApiBankHoliday>('/organization/bank-holidays/', payload);
  return mapBankHoliday(data);
}

export async function updateBankHoliday(
  id: string,
  payload: Partial<BankHolidayPayload>,
): Promise<BankHoliday> {
  const data = await apiPatch<ApiBankHoliday>(`/organization/bank-holidays/${id}/`, payload);
  return mapBankHoliday(data);
}

export async function deleteBankHoliday(id: string): Promise<void> {
  await apiDelete<null>(`/organization/bank-holidays/${id}/`);
}

export async function fetchBankHolidayLabelMap(): Promise<Record<string, string>> {
  const rows = await fetchBankHolidays();
  return Object.fromEntries(rows.map((row) => [row.holidayDate, row.holidayName]));
}

export async function fetchBankHolidayIsoDates(financialYearStart?: number): Promise<string[]> {
  const rows = await fetchBankHolidays(
    financialYearStart != null ? { financial_year: financialYearStart } : undefined,
  );
  return rows.map((row) => row.holidayDate);
}
