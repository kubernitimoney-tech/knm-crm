import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  FileSearch,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { PageHero } from '@/components/PageHero';
import { SectionHeader } from '@/components/SectionHeader';
import { LeadApiError, trackApplications } from '@/lib/leadsApi';
import { cn, formatCurrency } from '@/lib/utils';
import type { TrackApplicationItem } from '@/types/lead';

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizePan(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
}

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function buildApplyLink(pan: string, mobile: string) {
  const params = new URLSearchParams();
  const normalizedPan = normalizePan(pan);
  const normalizedMobile = normalizeMobile(mobile);
  if (normalizedPan) params.set('pan', normalizedPan);
  if (normalizedMobile) params.set('mobile', normalizedMobile);
  const query = params.toString();
  return query ? `/apply?${query}` : '/apply';
}

export function TrackPage() {
  const [panNo, setPanNo] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [applications, setApplications] = useState<TrackApplicationItem[]>([]);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const pan = normalizePan(panNo);
    const mobile = normalizeMobile(mobileNumber);

    if (!pan && !mobile) {
      setError('Enter a PAN number or mobile number to track your applications.');
      return;
    }
    if (pan && pan.length !== 10) {
      setError('PAN must be 10 characters (e.g. ABCDE1234F).');
      return;
    }
    if (mobile && mobile.length !== 10) {
      setError('Mobile number must be 10 digits.');
      return;
    }

    setLoading(true);
    setError(null);
    setOpenStatusId(null);

    try {
      const result = await trackApplications({
        ...(pan ? { pan_no: pan } : {}),
        ...(mobile ? { mobile_number: mobile } : {}),
      });
      setApplications(result.applications);
      setSearched(true);
    } catch (err) {
      const message =
        err instanceof LeadApiError
          ? err.message
          : 'Unable to track applications right now. Please try again.';
      setError(message);
      setApplications([]);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Application status"
        title="Track your application"
        description="Enter your PAN or registered mobile number to see all enquiries and loan applications linked to you."
        image="/personal-loan/personal-loan-3.svg"
        imageAlt="Person checking loan application status on a phone"
        chips={['PAN or mobile', 'All applications', 'Latest marked']}
        actions={
          <>
            <a href="#track-form" className="btn-primary">
              Track now
            </a>
            <Link to="/apply" className="btn-secondary">
              Apply Now
            </Link>
          </>
        }
      />

      <section id="track-form" className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Lookup"
            title="Find your applications"
            description="Use either PAN or mobile number. We’ll list every enquiry for that customer, newest first."
          />

          <form
            onSubmit={onSubmit}
            className="mt-8 grid gap-4 rounded-2xl border border-card-border bg-bg-app/60 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end md:p-6"
          >
            <div>
              <label htmlFor="track-pan" className="label-field">
                PAN number
              </label>
              <input
                id="track-pan"
                name="pan_no"
                className="input-field uppercase"
                placeholder="ABCDE1234F"
                value={panNo}
                onChange={(e) => setPanNo(normalizePan(e.target.value))}
                autoComplete="off"
                inputMode="text"
                maxLength={10}
              />
            </div>
            <div>
              <label htmlFor="track-mobile" className="label-field">
                Mobile number
              </label>
              <input
                id="track-mobile"
                name="mobile_number"
                className="input-field"
                placeholder="10-digit mobile"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(normalizeMobile(e.target.value))}
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            <button type="submit" className="btn-primary w-full md:w-auto" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Track
                </>
              )}
            </button>
          </form>

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

          {searched ? (
            <div className="mt-10">
              {applications.length > 0 ? (
                <>
                  <SectionHeader
                    eyebrow="Results"
                    title={`${applications.length} application${applications.length === 1 ? '' : 's'} found`}
                    description="Newest enquiry is marked Latest. Each card shows the loan type, amount, and status — the number is your application reference for support."
                  />

                  <ul className="mt-6 space-y-3">
                    {applications.map((app) => {
                      const isOpen = openStatusId === app.reference_id;
                      const submitted = formatDate(app.submitted_at || app.created_at);
                      const amount =
                        app.required_amount && !Number.isNaN(parseFloat(app.required_amount))
                          ? formatCurrency(app.required_amount)
                          : null;
                      const title = app.title || 'Loan enquiry';
                      return (
                        <li
                          key={app.reference_id}
                          className={cn(
                            'overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow',
                            app.is_latest
                              ? 'border-primary-deep/25 shadow-md ring-1 ring-primary-deep/10'
                              : 'border-card-border',
                          )}
                        >
                          <div className="flex">
                            <div
                              className={cn(
                                'w-1 shrink-0',
                                app.is_latest ? 'bg-primary-deep' : 'bg-lighter-gray/60',
                              )}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1 p-4 md:p-5">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-primary-deep md:text-lg">
                                      {title}
                                    </h3>
                                    {app.is_latest ? (
                                      <span className="rounded-full bg-primary-deep px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                                        Latest
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="mt-1 text-sm text-mid-shade">
                                    {[amount ? `Requested ${amount}` : null, submitted ? `Submitted ${submitted}` : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-lg bg-bg-app px-2.5 py-1 text-sm font-semibold text-primary-deep">
                                      {app.status_display}
                                    </span>
                                    <span className="text-xs text-light-gray">
                                      Ref. <span className="font-mono text-mid-shade">{app.reference_id}</span>
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={cn(
                                    'btn-secondary inline-flex shrink-0 items-center gap-1.5 !px-4 !py-2 text-sm',
                                    isOpen && 'bg-bg-app',
                                  )}
                                  aria-expanded={isOpen}
                                  onClick={() =>
                                    setOpenStatusId(isOpen ? null : app.reference_id)
                                  }
                                >
                                  {isOpen ? 'Hide details' : 'Show status'}
                                  <ChevronDown
                                    className={cn(
                                      'h-4 w-4 transition-transform',
                                      isOpen && 'rotate-180',
                                    )}
                                  />
                                </button>
                              </div>

                              {isOpen ? (
                                <div className="mt-4 rounded-xl border border-card-border bg-bg-app/80 px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-mid-shade">
                                    Current status
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-primary-deep">
                                    {app.status_display}
                                  </p>
                                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                      <dt className="text-xs text-light-gray">Application reference</dt>
                                      <dd className="font-mono font-medium text-primary-deep">
                                        {app.reference_id}
                                      </dd>
                                    </div>
                                    {amount ? (
                                      <div>
                                        <dt className="text-xs text-light-gray">Requested amount</dt>
                                        <dd className="font-medium text-primary-deep">{amount}</dd>
                                      </div>
                                    ) : null}
                                    {submitted ? (
                                      <div>
                                        <dt className="text-xs text-light-gray">Submitted on</dt>
                                        <dd className="font-medium text-primary-deep">{submitted}</dd>
                                      </div>
                                    ) : null}
                                    {app.loan_purpose ? (
                                      <div>
                                        <dt className="text-xs text-light-gray">Purpose</dt>
                                        <dd className="font-medium text-primary-deep">
                                          {app.loan_purpose}
                                        </dd>
                                      </div>
                                    ) : null}
                                  </dl>
                                  <p className="mt-3 text-sm text-mid-shade">
                                    Share this reference with support if you need help.{' '}
                                    <Link
                                      to="/contact"
                                      className="font-semibold text-primary-deep hover:underline"
                                    >
                                      Contact us
                                    </Link>
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-card-border bg-bg-app/50 px-5 py-10 text-center md:px-10 md:py-12">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-card-border">
                    <FileSearch className="h-7 w-7 text-primary-deep" aria-hidden />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-dark">
                    Results
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-primary-deep md:text-3xl">
                    No applications found
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-mid-shade md:text-base">
                    We couldn’t match these details to any enquiry. Double-check your PAN or
                    mobile, or start a new application if you haven’t applied yet.
                  </p>

                  <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-mid-shade">
                    <li className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" />
                      Use the same mobile or PAN you used while applying
                    </li>
                    <li className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" />
                      Try the other field if one doesn’t return results
                    </li>
                    <li className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-deep" />
                      Share your reference ID with support for a manual check
                    </li>
                  </ul>

                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link to="/contact" className="btn-secondary">
                      Contact support
                    </Link>
                    <Link to={buildApplyLink(panNo, mobileNumber)} className="btn-primary">
                      Start a new application
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <CtaBanner
        eyebrow="Need help?"
        title="Need help with your application?"
        description="Our team can guide you on documents, disbursal, or repayment — share your reference ID for faster support."
      />
    </>
  );
}
