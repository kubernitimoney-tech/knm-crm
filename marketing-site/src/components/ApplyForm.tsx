import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import {
  applyFormSchema,
  defaultFormValues,
  type ApplyFormValues,
} from '@/lib/applyFormSchema';
import {
  clearApplyFormDraft,
  loadApplyFormDraft,
  saveApplyFormDraft,
} from '@/lib/applyFormDraft';
import { submitLead, LeadApiError } from '@/lib/leadsApi';
import { trackLeadConversion } from '@/lib/analytics';
import { brand, loanPurposes, MIN_MONTHLY_INCOME } from '@/lib/brand';
import type { LeadIntakePayload } from '@/types/lead';
import { digitsOnly } from '@/lib/pincodeApi';
import { usePincodeAutofill } from '@/hooks/usePincodeAutofill';
import { DateOfBirthPicker } from '@/components/DateOfBirthPicker';
import { indianStates } from '@/data/indianStates';
import { cn } from '@/lib/utils';

const inputClass =
  'input-field !rounded-xl !border-card-border !bg-white !py-2.5 !text-[15px] shadow-none hover:!border-lighter-gray focus:!border-primary-deep focus:!bg-white focus:!ring-primary-deep/20';

function buildPayload(data: ApplyFormValues): LeadIntakePayload {
  return {
    first_name: data.first_name.trim(),
    email: data.email.trim(),
    mobile_number: data.mobile_number,
    required_amount: parseFloat(data.required_amount).toFixed(2),
    source_slug: 'website',
    dob: data.dob,
    gender: data.gender,
    pan_no: data.pan_no.toUpperCase(),
    aadhaar_no: data.aadhaar_no.replace(/\s/g, ''),
    loan_purpose: data.loan_purpose,
    employment: {
      monthly_salary: parseFloat(data.monthly_salary).toFixed(2),
      employment_type: data.employment_type,
    },
    address: {
      country: 'India',
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode,
    },
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>;
}

function FormLabel({
  htmlFor,
  id,
  children,
  required = false,
}: {
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  required?: boolean;
}) {
  const content = (
    <>
      {children}
      {required ? <span className="text-danger"> *</span> : null}
    </>
  );

  if (!htmlFor) {
    return (
      <p className="mb-1 block text-xs font-semibold text-secondary-dark" id={id}>
        {content}
      </p>
    );
  }

  return (
    <label className="mb-1 block text-xs font-semibold text-secondary-dark" htmlFor={htmlFor} id={id}>
      {content}
    </label>
  );
}

export function ApplyForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const trackPrefillApplied = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState('');
  const [success, setSuccess] = useState<{ lead_id: string; status_display: string } | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);

  const methods = useForm<ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: loadApplyFormDraft(),
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    control,
    formState: { errors },
  } = methods;

  const values = watch();
  const { lookupPincode, isLookingUp: isPincodeLookingUp } = usePincodeAutofill();

  useEffect(() => {
    if (trackPrefillApplied.current) return;

    const pan = (searchParams.get('pan') || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10);
    const mobile = (searchParams.get('mobile') || '').replace(/\D/g, '').slice(0, 10);
    if (!pan && !mobile) return;

    trackPrefillApplied.current = true;
    if (pan) {
      setValue('pan_no', pan, { shouldDirty: true, shouldValidate: true });
    }
    if (mobile) {
      setValue('mobile_number', mobile, { shouldDirty: true, shouldValidate: true });
    }

    const next = new URLSearchParams(searchParams);
    next.delete('pan');
    next.delete('mobile');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveApplyFormDraft(values);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [values]);

  const handlePincodeChange = (value: string) => {
    const pincode = digitsOnly(value, 6);
    setValue('pincode', pincode, { shouldDirty: true, shouldValidate: true });
    setPincodeLookupError(null);

    lookupPincode(
      pincode,
      (details) => {
        setValue('city', details.city, { shouldDirty: true, shouldValidate: true });
        setValue('state', details.state, { shouldDirty: true, shouldValidate: true });
        setPincodeLookupError(null);
      },
      setPincodeLookupError,
    );
  };

  const onSubmit = async (data: ApplyFormValues) => {
    if (honeypot.trim()) return;

    setSubmitting(true);
    setTopError('');

    try {
      const result = await submitLead(buildPayload(data));
      clearApplyFormDraft();
      setSuccess({ lead_id: result.lead_id, status_display: result.status_display });
      trackLeadConversion(result.lead_id);
    } catch (err) {
      if (err instanceof LeadApiError) {
        setTopError(err.message);
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          const formField = field
            .replace(/^employment\./, '')
            .replace(/^address\./, '') as keyof ApplyFormValues;
          if (formField in defaultFormValues) {
            setError(formField, { message });
          }
        }
        if (err.fieldErrors.required_amount) {
          setError('required_amount', { message: err.fieldErrors.required_amount });
        }
        if (err.fieldErrors['employment.monthly_salary']) {
          setError('monthly_salary', { message: err.fieldErrors['employment.monthly_salary'] });
        }
      } else {
        setTopError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="relative isolate overflow-hidden rounded-3xl border border-card-border bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-9 w-9 text-success" aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-primary-deep">Application submitted</h2>
        <p className="mx-auto mt-3 max-w-md text-mid-shade">
          Thank you. Our {brand.name} team will contact you shortly.
        </p>
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-card-border bg-bg-app px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-light-gray">Reference ID</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide text-primary-deep">
            {success.lead_id}
          </p>
          <p className="mt-2 text-sm text-mid-shade">Status: {success.status_display}</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/track" className="btn-primary">
            Track application
          </Link>
          <Link to="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative isolate rounded-2xl border border-card-border bg-white p-5 shadow-sm md:p-6 lg:p-7"
        noValidate
      >
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="company-website">Company website</label>
          <input
            id="company-website"
            name="company-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        {topError ? (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-3 text-sm text-danger">
            {topError}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormLabel htmlFor="first_name" required>
              Name (as per PAN)
            </FormLabel>
            <input
              id="first_name"
              className={inputClass}
              placeholder="Name as per PAN"
              autoComplete="name"
              {...register('first_name')}
            />
            <FieldError message={errors.first_name?.message} />
          </div>

          <div>
            <FormLabel htmlFor="mobile_number" required>
              Mobile number
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-light-gray">
                +91
              </span>
              <input
                id="mobile_number"
                className={cn(inputClass, '!pl-11')}
                placeholder="10-digit mobile"
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel"
                {...register('mobile_number')}
              />
            </div>
            <FieldError message={errors.mobile_number?.message} />
          </div>

          <div>
            <FormLabel htmlFor="aadhaar_no" required>
              Aadhaar number
            </FormLabel>
            <input
              id="aadhaar_no"
              className={inputClass}
              placeholder="12-digit Aadhaar"
              inputMode="numeric"
              maxLength={12}
              {...register('aadhaar_no')}
            />
            <FieldError message={errors.aadhaar_no?.message} />
          </div>

          <div>
            <FormLabel htmlFor="monthly_salary" required>
              Monthly salary
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-light-gray">
                ₹
              </span>
              <input
                id="monthly_salary"
                type="number"
                className={cn(inputClass, '!pl-8')}
                placeholder={`Min ${MIN_MONTHLY_INCOME.toLocaleString('en-IN')}`}
                {...register('monthly_salary')}
              />
            </div>
            <FieldError message={errors.monthly_salary?.message} />
          </div>

          <div>
            <FormLabel htmlFor="required_amount" required>
              Loan required
            </FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-light-gray">
                ₹
              </span>
              <input
                id="required_amount"
                type="number"
                className={cn(inputClass, '!pl-8')}
                placeholder="Loan amount"
                {...register('required_amount')}
              />
            </div>
            <FieldError message={errors.required_amount?.message} />
          </div>

          <div>
            <FormLabel htmlFor="pan_no" required>
              PAN card
            </FormLabel>
            <input
              id="pan_no"
              className={cn(inputClass, 'uppercase')}
              placeholder="ABCDE1234F"
              maxLength={10}
              autoComplete="off"
              {...register('pan_no')}
            />
            <FieldError message={errors.pan_no?.message} />
          </div>

          <div>
            <FormLabel id="dob-label" required>
              Date of birth
            </FormLabel>
            <Controller
              name="dob"
              control={control}
              render={({ field }) => (
                <DateOfBirthPicker
                  id="dob"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <FieldError message={errors.dob?.message} />
          </div>

          <div>
            <FormLabel htmlFor="state" required>
              State
            </FormLabel>
            <select id="state" className={inputClass} {...register('state')}>
              <option value="">Select state</option>
              {indianStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
              {values.state && !indianStates.includes(values.state as (typeof indianStates)[number]) ? (
                <option value={values.state}>{values.state}</option>
              ) : null}
            </select>
            <FieldError message={errors.state?.message} />
          </div>

          <div>
            <FormLabel htmlFor="city" required>
              City
            </FormLabel>
            <input
              id="city"
              className={inputClass}
              placeholder="City"
              autoComplete="address-level2"
              {...register('city')}
            />
            <FieldError message={errors.city?.message} />
          </div>

          <div>
            <FormLabel htmlFor="pincode" required>
              Pincode
            </FormLabel>
            <input
              id="pincode"
              className={inputClass}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              value={values.pincode}
              onChange={(event) => handlePincodeChange(event.target.value)}
            />
            {isPincodeLookingUp ? (
              <p className="mt-1 text-xs text-mid-shade">Fetching city and state…</p>
            ) : null}
            {pincodeLookupError ? (
              <p className="mt-1 text-xs font-medium text-danger">{pincodeLookupError}</p>
            ) : null}
            <FieldError message={errors.pincode?.message} />
          </div>

          <div>
            <FormLabel htmlFor="email" required>
              Email ID
            </FormLabel>
            <input
              id="email"
              type="email"
              className={inputClass}
              placeholder="Email ID"
              autoComplete="email"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <FormLabel htmlFor="gender" required>
              Gender
            </FormLabel>
            <select id="gender" className={inputClass} {...register('gender')}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <FieldError message={errors.gender?.message} />
          </div>

          <div>
            <FormLabel htmlFor="employment_type" required>
              Employment
            </FormLabel>
            <select id="employment_type" className={inputClass} {...register('employment_type')}>
              <option value="">Select employment</option>
              <option value="salaried">Salaried</option>
              <option value="self_employed">Self employed</option>
            </select>
            <FieldError message={errors.employment_type?.message} />
          </div>

          <div className="sm:col-span-2">
            <FormLabel htmlFor="loan_purpose" required>
              Purpose
            </FormLabel>
            <select id="loan_purpose" className={inputClass} {...register('loan_purpose')}>
              <option value="">Select purpose</option>
              {loanPurposes.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {purpose}
                </option>
              ))}
            </select>
            <FieldError message={errors.loan_purpose?.message} />
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-card-border pt-4">
          <div>
            <label
              htmlFor="accept_terms"
              className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-mid-shade md:text-[13px]"
            >
              <input
                id="accept_terms"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-card-border text-primary-deep accent-primary-deep"
                {...register('accept_terms')}
              />
              <span>
                I agree to the {brand.name}{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-deep underline-offset-2 hover:underline"
                >
                  Terms and Conditions
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-deep underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>
                . Contact details may be used for service messages; you can unsubscribe anytime.{' '}
                <span className="text-danger">*</span>
              </span>
            </label>
            <FieldError message={errors.accept_terms?.message} />
          </div>

          <div>
            <label
              htmlFor="data_consent"
              className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-mid-shade md:text-[13px]"
            >
              <input
                id="data_consent"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-card-border text-primary-deep accent-primary-deep"
                {...register('data_consent')}
              />
              <span>
                I consent to processing of my personal data (name, mobile, email, PAN, masked Aadhaar)
                by {brand.name} for loan evaluation and KYC, under DPDP Act, 2023 and RBI (NBFC-KYC)
                Direction, 2025. Contact{' '}
                <a
                  href="mailto:info@kubernitimoney.com"
                  className="font-semibold text-primary-deep underline-offset-2 hover:underline"
                >
                  info@kubernitimoney.com
                </a>{' '}
                to withdraw consent. <span className="text-danger">*</span>
              </span>
            </label>
            <FieldError message={errors.data_consent?.message} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary group mt-1 w-full !rounded-xl !py-3"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                Submit application
                <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
