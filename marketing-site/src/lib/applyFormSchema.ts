import { z } from 'zod';
import type { DefaultValues } from 'react-hook-form';
import { loanPurposes, MIN_MONTHLY_INCOME } from '@/lib/brand';
import { isAtLeast21 } from '@/lib/dateUtils';

const indianMobileRegex = /^[6-9]\d{9}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadhaarRegex = /^\d{12}$/;
const pincodeRegex = /^\d{6}$/;

export const applyFormSchema = z
  .object({
    /** Full name as printed on PAN card → API first_name */
    first_name: z
      .string()
      .min(1, 'Name as per PAN is required')
      .max(150, 'Name must be under 150 characters')
      .refine((v) => v.trim().length >= 2, 'Enter your full name as per PAN'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    mobile_number: z
      .string()
      .min(1, 'Mobile number is required')
      .regex(indianMobileRegex, 'Enter a valid 10-digit Indian mobile number'),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: z.string().min(1, 'Select gender'),
    pan_no: z
      .string()
      .min(1, 'PAN is required')
      .refine((v) => panRegex.test(v.toUpperCase()), 'Enter a valid PAN number'),
    aadhaar_no: z
      .string()
      .min(1, 'Aadhaar is required')
      .refine((v) => aadhaarRegex.test(v.replace(/\s/g, '')), 'Enter a valid 12-digit Aadhaar number'),
    required_amount: z
      .string()
      .min(1, 'Loan amount is required')
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Enter a valid loan amount'),
    loan_purpose: z.string().min(1, 'Select loan purpose'),
    employment_type: z.enum(['salaried', 'self_employed'], {
      required_error: 'Select employment type',
      invalid_type_error: 'Select a valid employment type',
    }),
    monthly_salary: z
      .string()
      .min(1, 'Monthly salary is required')
      .refine(
        (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= MIN_MONTHLY_INCOME,
        `Monthly salary must be at least ₹${MIN_MONTHLY_INCOME.toLocaleString('en-IN')}`,
      ),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    pincode: z
      .string()
      .min(1, 'Pincode is required')
      .regex(pincodeRegex, 'Enter a valid 6-digit pincode'),
    accept_terms: z
      .boolean()
      .refine((v) => v === true, 'Please agree to the Terms & Conditions and Privacy Policy'),
    data_consent: z
      .boolean()
      .refine(
        (v) => v === true,
        'Please provide consent to process your personal data for loan evaluation',
      ),
  })
  .superRefine((data, ctx) => {
    if (!isAtLeast21(data.dob)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must be at least 21 years old',
        path: ['dob'],
      });
    }

    if (data.loan_purpose && !loanPurposes.includes(data.loan_purpose as (typeof loanPurposes)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid loan purpose',
        path: ['loan_purpose'],
      });
    }

    const salary = parseFloat(data.monthly_salary);
    const amount = parseFloat(data.required_amount);
    if (!isNaN(amount) && !isNaN(salary) && amount >= salary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Loan amount must be less than monthly salary',
        path: ['required_amount'],
      });
    }
  });

export type ApplyFormValues = z.infer<typeof applyFormSchema>;

export const defaultFormValues: DefaultValues<ApplyFormValues> = {
  first_name: '',
  email: '',
  mobile_number: '',
  dob: '',
  gender: '',
  pan_no: '',
  aadhaar_no: '',
  required_amount: '',
  loan_purpose: '',
  employment_type: undefined,
  monthly_salary: '',
  city: '',
  state: '',
  pincode: '',
  accept_terms: false,
  data_consent: false,
};
