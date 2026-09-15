import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Logo } from '@/components/Logo';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const EMAIL_OTP_SECONDS = 180;
const VID_GENERATE_URL = 'https://resident.uidai.gov.in/web/resident/vidgeneration';
const VID_HELP_URL = 'https://uidai.gov.in/en/286-faqs/aadhaar-enrolment-update/virtual-id-vid.html';

type Step = 'send_code' | 'email_otp' | 'document' | 'aadhaar' | 'aadhaar_otp';

interface PublicEsignSession {
  id: string;
  document_name: string;
  customer_name: string;
  document_url: string;
  signed: boolean;
  signed_file_url: string | null;
  mobile_hint?: string;
  email_hint?: string;
  email_verified?: boolean;
  company_name?: string;
  company_email?: string;
  reason?: string;
  city?: string;
  created_at?: string | null;
  signed_at?: string | null;
  transaction_id?: string;
  status?: string;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function isValidAadhaarOrVid(value: string) {
  return value.length === 12 || value.length === 16;
}

function apiError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return String(err.response.data.message);
  }
  return err instanceof Error ? err.message : fallback;
}

function formatStamp(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCountdown(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function SixDigitOtp({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');

  const focusAt = (index: number) => {
    refs.current[Math.max(0, Math.min(5, index))]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          className="h-12 w-10 rounded-md border border-slate-300 bg-white text-center text-lg font-semibold text-slate-800 outline-none focus:border-[#4caf82] focus:ring-2 focus:ring-[#4caf82]/20"
          onChange={(event) => {
            const incoming = digitsOnly(event.target.value);
            if (!incoming) {
              const next = digits.map((item, itemIndex) => (itemIndex === index ? '' : item)).join('');
              onChange(next);
              return;
            }
            if (incoming.length > 1) {
              onChange(incoming.slice(0, 6));
              focusAt(Math.min(incoming.length, 5));
              return;
            }
            const nextDigits = [...digits];
            nextDigits[index] = incoming;
            onChange(nextDigits.join('').replace(/\s/g, ''));
            if (index < 5) focusAt(index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              event.preventDefault();
              const nextDigits = [...digits];
              nextDigits[index - 1] = '';
              onChange(nextDigits.join(''));
              focusAt(index - 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = digitsOnly(event.clipboardData.getData('text')).slice(0, 6);
            onChange(pasted);
            focusAt(Math.min(pasted.length, 5));
          }}
        />
      ))}
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 72 56" className="mx-auto h-14 w-16 text-slate-800" fill="none" aria-hidden>
      <rect x="4" y="10" width="64" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <path d="M6 14 L36 34 L66 14" stroke="currentColor" strokeWidth="2.5" />
      <text x="36" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        @
      </text>
    </svg>
  );
}

function SuccessBadge() {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28" aria-hidden>
      <path
        fill="#7ee0c8"
        d="M60 4c6 0 8 6 12 8 4 2 10 0 13 4 3 4 2 10 6 13 4 3 10 2 12 8 2 6-2 10 0 16s6 10 4 16c-2 6-8 7-10 12s2 11-2 15c-4 4-10 1-14 4s-5 10-11 11c-6 1-10-4-16-4s-10 5-16 4c-6-1-7-8-11-11s-10-0-14-4c-4-4-0-10-2-15s-8-6-10-12c-2-6 2-10 0-16s-6-10-4-16c2-6 8-5 12-8 4-3 3-9 6-13 3-4 9-2 13-4 4-2 6-8 12-8z"
      />
      <path
        d="M38 62 L53 76 L84 42"
        fill="none"
        stroke="#ffffff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-center text-sm text-red-600">{message}</p>;
}

export function PublicEsignPage() {
  useTitle('E-Agreements');
  const { esignId } = useParams<{ esignId: string }>();
  const [session, setSession] = useState<PublicEsignSession | null>(null);
  const [step, setStep] = useState<Step>('send_code');
  const [error, setError] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [identity, setIdentity] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [showAadhaarOtp, setShowAadhaarOtp] = useState(false);
  const [otpEmailHint, setOtpEmailHint] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EMAIL_OTP_SECONDS);
  const [otpRound, setOtpRound] = useState(0);
  const [language, setLanguage] = useState('en');

  const load = useCallback(async () => {
    if (!esignId) return;
    const { data } = await axios.get<{ success: boolean; data: PublicEsignSession; message?: string }>(
      `${API_BASE_URL}/leads/esign/${esignId}/`,
    );
    if (!data.success) {
      throw new Error(data.message || 'Could not load the signing request.');
    }
    setSession(data.data);
    if (data.data.signed) return;
    if (data.data.email_verified) {
      setStep((current) =>
        current === 'send_code' || current === 'email_otp' ? 'document' : current,
      );
    }
  }, [esignId]);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err: unknown) => {
        setError(apiError(err, 'Could not load the signing request.'));
      })
      .finally(() => setIsLoading(false));
  }, [load]);

  const showDocument = step === 'document' || step === 'aadhaar' || step === 'aadhaar_otp';

  useEffect(() => {
    if (!session?.document_url || session.signed || !showDocument) {
      setPreviewUrl('');
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    axios
      .get(session.document_url, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(session.document_url);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.document_url, session?.signed, showDocument]);

  useEffect(() => {
    if (step !== 'email_otp') return;
    setSecondsLeft(EMAIL_OTP_SECONDS);
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, otpRound]);

  const sendEmailCode = async () => {
    if (!esignId) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post<{ success: boolean; message?: string }>(
        `${API_BASE_URL}/leads/esign/${esignId}/email-otp/`,
        {},
      );
      if (!data.success) throw new Error(data.message || 'Could not send the verification code.');
      setEmailOtp('');
      setOtpRound((value) => value + 1);
      setStep('email_otp');
    } catch (err: unknown) {
      setError(apiError(err, 'Could not send the verification code.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailCode = async () => {
    if (!esignId) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post<{
        success: boolean;
        data?: PublicEsignSession;
        message?: string;
      }>(`${API_BASE_URL}/leads/esign/${esignId}/verify-email-otp/`, {
        otp: digitsOnly(emailOtp),
      });
      if (!data.success) throw new Error(data.message || 'Email verification failed.');
      if (data.data) setSession(data.data);
      setStep('document');
    } catch (err: unknown) {
      setError(apiError(err, 'Email verification failed.'));
    } finally {
      setBusy(false);
    }
  };

  const sendAadhaarOtp = async () => {
    if (!esignId) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post<{
        success: boolean;
        data?: { email_hint?: string };
        message?: string;
      }>(`${API_BASE_URL}/leads/esign/${esignId}/otp/`, {
        aadhaar_number: digitsOnly(identity),
      });
      if (!data.success) throw new Error(data.message || 'Could not send OTP.');
      setAadhaarOtp('');
      setOtpEmailHint(data.data?.email_hint || session?.email_hint || '');
      setStep('aadhaar_otp');
    } catch (err: unknown) {
      setError(apiError(err, 'Could not send OTP.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyAadhaarOtp = async () => {
    if (!esignId) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post<{
        success: boolean;
        data?: PublicEsignSession;
        message?: string;
      }>(`${API_BASE_URL}/leads/esign/${esignId}/verify-otp/`, { otp: digitsOnly(aadhaarOtp) });
      if (!data.success) throw new Error(data.message || 'OTP verification failed.');
      if (data.data) setSession(data.data);
      else await load();
    } catch (err: unknown) {
      setError(apiError(err, 'OTP verification failed.'));
    } finally {
      setBusy(false);
    }
  };

  const identityDigits = digitsOnly(identity);
  const brand = session?.company_name || 'Kuberniti Money';
  const requester = brand.toUpperCase();
  const reason = session?.reason || session?.document_name || 'Loan Agreement';
  const stamp = formatStamp(session?.signed_at || session?.created_at);

  const documentFrame = (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-slate-50">
      {previewUrl ? (
        <iframe
          title={session?.document_name || 'Agreement.pdf'}
          src={previewUrl}
          className="h-[70vh] min-h-[420px] w-full bg-white"
        />
      ) : (
        <div className="flex h-[70vh] min-h-[420px] items-center justify-center text-sm text-slate-500">
          Loading document…
        </div>
      )}
    </div>
  );

  const aadhaarConsent = (
    <div className="max-h-40 overflow-y-auto rounded border border-slate-300 bg-white px-3 py-2 text-[11px] leading-5 text-slate-700">
      <p>
        1. Use my Aadhaar / Virtual ID details (as applicable), for/with{' '}
        <span className="font-semibold uppercase">{requester}</span> and authenticate my identity
        through the Aadhaar Authentication system (Aadhaar based e-KYC services of UIDAI) in
        accordance with the provisions of the Aadhaar (Targeted Delivery of Financial and other
        Subsidies, Benefits and Services) Act, 2016 and the allied rules and regulations notified
        thereunder and for no other purpose.
      </p>
      <p className="mt-2">
        2. Authenticate my Aadhaar / Virtual ID through OTP or Biometric for authenticating my
        identity through the Aadhaar Authentication system for obtaining my e-KYC through Aadhaar
        based e-KYC services of UIDAI and use my Photo and Demographic details (Name, Gender, Date
        of Birth and Address) for/with{' '}
        <span className="font-semibold uppercase">{requester}</span>.
      </p>
      <p className="mt-2">
        3. I understand that Security and confidentiality of personal identity data provided, for
        the purpose of Aadhaar based authentication is ensured by Protean eGov Technologies Limited
        and the data will be stored by Protean eGov Technologies Limited as per the guidelines from
        UIDAI from time to time.
      </p>
      <p className="mt-2">
        4. For any concerns or disputes on the translated Consent Statement, the &apos;English&apos;
        version of this Consent Statement shall prevail and be considered the official and final
        version.
      </p>
    </div>
  );

  const aadhaarIntro = (
    <div className="space-y-3 text-center">
      <Logo className="mx-auto justify-center" imageClassName="h-12 max-h-12" />
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">{requester}</p>
      <p className="text-sm text-slate-700">has requested to Digitally sign the document</p>
      <p className="text-[11px] text-slate-500">
        Transaction ID: {session?.transaction_id || session?.id}
        {stamp ? ` dated ${stamp.replace(' ', 'T')}` : ''}
      </p>
      <label className="mx-auto block w-40 text-left text-xs text-slate-600">
        <span className="sr-only">Select a Language</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="en">Select a Language</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>
      </label>
    </div>
  );

  const vidLinks = (
    <p className="text-center text-[11px] leading-5">
      <a
        href={VID_GENERATE_URL}
        target="_blank"
        rel="noreferrer"
        className="text-[#2f6fdb] underline"
      >
        Click Here to generate Virtual ID.
      </a>{' '}
      <a href={VID_HELP_URL} target="_blank" rel="noreferrer" className="text-[#2f6fdb] underline">
        Download Instructions to generate Virtual ID in lieu of Aadhaar.
      </a>
    </p>
  );

  return (
    <div className="min-h-screen bg-white">
      {isLoading ? (
        <p className="px-4 py-24 text-center text-sm text-slate-500">Loading…</p>
      ) : error && !session ? (
        <p className="px-4 py-24 text-center text-sm text-red-600">{error}</p>
      ) : session?.signed ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <SuccessBadge />
          <p className="mt-4 text-lg font-medium text-[#7dcec0]">Signed Successfully</p>
        </div>
      ) : step === 'send_code' ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <h1 className="text-xl font-bold text-slate-900">Verify Your Email</h1>
            <p className="mt-3 text-sm text-slate-500">
              Please click the button below to send the verification code to your email.
            </p>
            <ErrorText message={error} />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendEmailCode()}
              className="mt-6 w-full rounded-md bg-[#4caf82] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send Verification Code'}
            </button>
            <p className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Secured By <span className="font-medium text-[#4c6fff]">{brand}</span>
            </p>
          </div>
        </div>
      ) : step === 'email_otp' ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <EnvelopeIcon />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Enter Verification Code</h1>
            <p className="mt-2 text-sm text-slate-500">
              Please enter the 6-digit code sent to your email.
            </p>
            <div className="mt-6">
              <SixDigitOtp value={emailOtp} onChange={setEmailOtp} disabled={busy} />
            </div>
            <ErrorText message={error} />
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={busy || digitsOnly(emailOtp).length < 6}
                onClick={() => void verifyEmailCode()}
                className="rounded-md bg-[#7dce8a] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendEmailCode()}
                className="rounded-md bg-[#9aa0a6] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Resend Code
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-500">Time Remaining: {formatCountdown(secondsLeft)}</p>
          </div>
        </div>
      ) : step === 'document' ? (
        <div className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-lg font-bold text-slate-900">{brand}</h1>
          {session?.company_email ? (
            <p className="text-sm text-slate-600">({session.company_email})</p>
          ) : null}
          <h2 className="mt-6 text-base font-bold text-slate-900">Reason For Request:-</h2>
          <p className="mt-1 text-sm text-slate-700">{reason}</p>
          <div className="mt-6 rounded-md border border-amber-100 bg-[#fbf6e9] px-4 py-4">
            <h3 className="text-center text-lg font-semibold text-slate-800">Signers</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-800">
              <p>
                Status :{' '}
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Pending
                </span>
              </p>
              <p>Name : {session?.customer_name || '—'}</p>
              <p>Email : {session?.email_hint || '—'}</p>
              <p>Phone : {session?.mobile_hint || '—'}</p>
              <p>City : {session?.city || '—'}</p>
              <p>Signed At : {stamp || '—'}</p>
            </div>
          </div>
          <div className="mt-4">{documentFrame}</div>
          <p className="mt-6 text-center text-sm text-slate-800">
            By continuing, I agree to do eKyc using Aadhaar to eSign with the ESPs (NSDL e-Gov).{' '}
            {brand} is registered as ASP.
          </p>
          <ErrorText message={error} />
          <button
            type="button"
            onClick={() => {
              setError('');
              setStep('aadhaar');
            }}
            className="mx-auto mt-4 block rounded-full bg-[#4caf82] px-10 py-2.5 text-sm font-semibold text-white"
          >
            Sign Now
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-xl px-4 py-6">
          {aadhaarIntro}
          <p className="mt-4 text-center text-xs italic text-[#2f6fdb]">
            Please click on the checkbox and enter Aadhaar / Virtual ID
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-[#f7f9fc] p-3">
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                I hereby authorize Protean eGov Technologies Limited to:
              </span>
            </label>
            <div className="mt-2">{aadhaarConsent}</div>
            {step === 'aadhaar' ? (
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span>VID/Aadhaar:</span>
                  <span className="relative flex-1">
                    <input
                      type={showIdentity ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={16}
                      placeholder="Enter VID/Aadhaar"
                      value={identity}
                      disabled={!reviewed}
                      onChange={(event) => setIdentity(digitsOnly(event.target.value).slice(0, 16))}
                      className="w-full rounded border border-slate-400 bg-white px-3 py-2 pr-10 text-sm disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                      onClick={() => setShowIdentity((value) => !value)}
                      aria-label={showIdentity ? 'Hide Aadhaar' : 'Show Aadhaar'}
                    >
                      {showIdentity ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
                <ErrorText message={error} />
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy || !reviewed || !isValidAadhaarOrVid(identityDigits)}
                    onClick={() => void sendAadhaarOtp()}
                    className="min-w-28 rounded-md bg-[#5b9bd5] px-6 py-2 text-sm font-semibold uppercase text-white disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send OTP'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStep('document')}
                    className="min-w-28 rounded-md bg-[#e8a317] px-6 py-2 text-sm font-semibold uppercase text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="whitespace-nowrap">ENTER OTP :</span>
                  <span className="relative flex-1">
                    <input
                      type={showAadhaarOtp ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={aadhaarOtp}
                      onChange={(event) => setAadhaarOtp(digitsOnly(event.target.value).slice(0, 8))}
                      className="w-full rounded border border-slate-400 bg-white px-3 py-2 pr-10 text-sm tracking-[0.35em]"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                      onClick={() => setShowAadhaarOtp((value) => !value)}
                      aria-label={showAadhaarOtp ? 'Hide OTP' : 'Show OTP'}
                    >
                      {showAadhaarOtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
                <ErrorText message={error} />
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy || digitsOnly(aadhaarOtp).length < 4}
                    onClick={() => void verifyAadhaarOtp()}
                    className="min-w-28 rounded-md bg-[#5b9bd5] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? 'Verifying…' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setAadhaarOtp('');
                      setStep('aadhaar');
                    }}
                    className="min-w-28 rounded-md bg-[#e8a317] px-6 py-2 text-sm font-semibold text-white"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">
                  Success! OTP has been sent to email {otpEmailHint || session?.email_hint || 'your registered email'}
                </p>
              </div>
            )}
            <div className="mt-4">{vidLinks}</div>
          </div>
          <p className="mt-8 text-center text-[11px] text-slate-500">
            Please do not press &apos;Submit&apos; button once again or the &apos;Refresh&apos; or
            &apos;Back&apos; buttons.
          </p>
        </div>
      )}
    </div>
  );
}
