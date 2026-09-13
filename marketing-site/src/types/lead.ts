export interface LeadEmployment {
  employer_name?: string;
  designation?: string;
  employment_type?: string;
  monthly_salary?: string;
}

export interface LeadAddress {
  address_type?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface LeadIntakePayload {
  first_name: string;
  last_name?: string;
  email: string;
  mobile_number: string;
  required_amount: string;
  source_slug: 'website';
  dob?: string;
  gender?: string;
  pan_no?: string;
  aadhaar_no?: string;
  loan_purpose?: string;
  employment?: LeadEmployment;
  address?: LeadAddress;
}

export interface LeadIntakeResponseData {
  id?: string;
  lead_id: string;
  category?: string;
  category_display: string;
  status?: string;
  status_display: string;
  source_slug?: string;
  source_name?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success?: false;
  message?: string;
  errors?: Record<string, unknown>;
}

export interface LeadSource {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface TrackApplicationItem {
  reference_id: string;
  title: string;
  is_latest: boolean;
  status: string;
  status_display: string;
  required_amount?: string | null;
  loan_purpose?: string | null;
  submitted_at?: string;
  created_at?: string;
}

export interface TrackApplicationsResponse {
  found: boolean;
  applications: TrackApplicationItem[];
}

export interface TrackApplicationsPayload {
  pan_no?: string;
  mobile_number?: string;
}

export interface ApplyFormData {
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  dob: string;
  gender: string;
  pan_no: string;
  aadhaar_no: string;
  required_amount: string;
  loan_purpose: string;
  employer_name: string;
  designation: string;
  employment_type: string;
  monthly_salary: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
}
