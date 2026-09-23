import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { PdfInlineViewer } from './PdfInlineViewer';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const EMAIL_OTP_SECONDS = 180;

type Step = 'send_code' | 'email_otp' | 'document' | 'returning';

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
  company_url?: string;
  company_email?: string;
  reason?: string;
  city?: string;
  created_at?: string | null;
  signed_at?: string | null;
  transaction_id?: string;
  status?: string;
  signing_url?: string;
  document_id?: string;
  identifier?: string;
  access_token?: string;
  environment?: 'sandbox' | 'production';
  sdk_url?: string;
}

interface DigioInstance {
  init: () => void;
  submit: (documentId: string, identifier: string, token?: string) => void;
}

interface DigioConstructor {
  new (options: {
    environment: string;
    is_redirection_approach?: boolean;
    redirect_url?: string;
    callback: (response: { error_code?: string; message?: string }) => void;
  }): DigioInstance;
}

function getDigioConstructor(): DigioConstructor | undefined {
  return (window as unknown as { Digio?: DigioConstructor }).Digio;
}

function loadDigioSdk(src: string): Promise<DigioConstructor> {
  const current = getDigioConstructor();
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const loaded = getDigioConstructor();
      if (loaded) resolve(loaded);
      else reject(new Error('Digio signing failed to load.'));
    };
    script.onerror = () => reject(new Error('Digio signing failed to load.'));
    document.body.appendChild(script);
  });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
          className="h-12 w-10 rounded-md border border-slate-300 bg-white text-center text-lg font-semibold text-[#1f2130] outline-none focus:border-[#4caf82] focus:ring-2 focus:ring-[#4caf82]/20"
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

function BrandLink({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[#4c6fff] underline-offset-2 hover:underline"
    >
      {name}
    </a>
  );
}

export function PublicEsignPage() {
  useTitle('E-Agreements');
  const { esignId } = useParams<{ esignId: string }>();
  const returningFromEsp = new URLSearchParams(window.location.search).get('done') === '1';
  const [session, setSession] = useState<PublicEsignSession | null>(null);
  const [step, setStep] = useState<Step>(returningFromEsp ? 'returning' : 'send_code');
  const [error, setError] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [signedPreviewUrl, setSignedPreviewUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EMAIL_OTP_SECONDS);
  const [otpRound, setOtpRound] = useState(0);
  const [awaitingSigned, setAwaitingSigned] = useState(returningFromEsp);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }, []);

  const load = useCallback(
    async (sync = false, force = false) => {
      if (!esignId) return null;
      const query = sync ? `?sync=1${force ? '&force=1' : ''}` : '';
      const { data } = await axios.get<{
        success: boolean;
        data: PublicEsignSession;
        message?: string;
      }>(`${API_BASE_URL}/leads/esign/${esignId}/${query}`);
      if (!data.success) {
        throw new Error(data.message || 'Could not load the signing request.');
      }
      setSession(data.data);
      return data.data;
    },
    [esignId],
  );

  useEffect(() => {
    setIsLoading(true);
    load(returningFromEsp)
      .then((row) => {
        if (!row) return;
        if (row.signed) return;
        if (returningFromEsp) return;
        if (row.email_verified) setStep('document');
      })
      .catch((err: unknown) => {
        setError(apiError(err, 'Could not load the signing request.'));
      })
      .finally(() => setIsLoading(false));
  }, [load, returningFromEsp]);

  useEffect(() => {
    if (session?.signed || (!awaitingSigned && !busy)) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        if (cancelled) return;
        const row = await load(true, awaitingSigned && attempt > 0).catch(() => null);
        if (row?.signed) {
          setBusy(false);
          return;
        }
        await sleep(2000);
      }
      if (!cancelled) {
        setBusy(false);
        setError('Signing is still processing. Refresh this page in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, awaitingSigned, busy, session?.signed]);

  const showDocument = step === 'document' && !awaitingSigned && !session?.signed;

  useEffect(() => {
    if (!session?.signed) {
      setSignedPreviewUrl('');
      return;
    }
    const url = session.document_url;
    if (!url) return;
    let objectUrl = '';
    let cancelled = false;
    axios
      .get(url, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setSignedPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSignedPreviewUrl(url);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.signed, session?.signed_file_url, session?.document_url]);

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

  const startAadhaarEsign = async () => {
    if (!session?.document_id || !session.identifier || !session.sdk_url) {
      setError('This signing request is missing the Aadhaar eSign details. Ask the team to send a new request.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const Digio = await loadDigioSdk(session.sdk_url);
      const returnUrl = `${window.location.origin}${window.location.pathname}?done=1`;
      const digio = new Digio({
        environment: session.environment || 'production',
        is_redirection_approach: false,
        redirect_url: returnUrl,
        callback: (response) => {
          if (response?.error_code) {
            setAwaitingSigned(false);
            setError(response.message || 'Signing was not completed.');
            setBusy(false);
            return;
          }
          setBusy(false);
          setAwaitingSigned(true);
        },
      });
      digio.init();
      if (session.access_token) {
        digio.submit(session.document_id, session.identifier, session.access_token);
      } else {
        digio.submit(session.document_id, session.identifier);
      }
    } catch (err: unknown) {
      setError(apiError(err, 'Could not start Aadhaar eSign.'));
      setBusy(false);
    }
  };

  const brand = session?.company_name || 'Kuberniti Money';
  const brandUrl = session?.company_url || 'https://kubernitimoney.com';
  const reason = session?.reason || session?.document_name || 'Loan Agreement';
  const stamp = formatStamp(session?.signed_at || session?.created_at);

  const documentFrame = previewUrl ? (
    <PdfInlineViewer src={previewUrl} title={session?.document_name || 'Agreement.pdf'} />
  ) : (
    <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-sm border border-slate-200 bg-white text-sm text-[#424665]">
      Loading agreement…
    </div>
  );

  return (
    <div className="public-guest-page min-h-screen bg-[#f4f6f9] text-[#1f2130]">
      {isLoading ? (
        <p className="px-4 py-24 text-center text-sm text-[#424665]">Loading…</p>
      ) : error && !session ? (
        <p className="px-4 py-24 text-center text-sm text-red-600">{error}</p>
      ) : session?.signed ? (
        <div className="mx-auto max-w-4xl px-4 py-10">
          <SuccessBadge />
          <p className="mt-4 text-center text-xl font-semibold text-[#2f9e86]">eSign completed</p>
          <p className="mt-2 text-center text-sm text-[#424665]">
            Thank you. The loan agreement has been signed with Aadhaar OTP. A signed copy has been
            emailed to you.
          </p>
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-[#1f2130]">
            <p>
              Status :{' '}
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed
              </span>
            </p>
            <p className="mt-1">Name : {session.customer_name || '—'}</p>
            <p>Signed At : {stamp || '—'}</p>
          </div>
          <a
            href={session.document_url}
            download="Signed-Agreement.pdf"
            className="mx-auto mt-4 block w-fit rounded-md bg-[#4caf82] px-5 py-2 text-sm font-semibold text-white"
          >
            Download signed PDF
          </a>
          <div className="mt-4">
            {signedPreviewUrl ? (
              <PdfInlineViewer src={signedPreviewUrl} title="Signed agreement" />
            ) : (
              <p className="py-10 text-center text-sm text-[#424665]">Loading signed agreement…</p>
            )}
          </div>
        </div>
      ) : awaitingSigned ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <SuccessBadge />
          <p className="mt-4 text-center text-xl font-semibold text-[#2f9e86]">eSign completed</p>
          <p className="mt-2 text-center text-sm text-[#424665]">
            Fetching your signed agreement and sending a copy to your email…
          </p>
          <ErrorText message={error} />
        </div>
      ) : step === 'send_code' ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <h1 className="text-xl font-bold text-[#1f2130]">Verify Your Email</h1>
            <p className="mt-3 text-sm text-[#424665]">
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
            <p className="mt-6 flex items-center justify-center gap-1 text-xs text-[#1f2130]">
              <Lock className="h-3.5 w-3.5" />
              Secured By : <BrandLink name={brand} url={brandUrl} />
            </p>
          </div>
        </div>
      ) : step === 'email_otp' ? (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <EnvelopeIcon />
            <h1 className="mt-4 text-xl font-bold text-[#1f2130]">Enter Verification Code</h1>
            <p className="mt-2 text-sm text-[#424665]">
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
            <p className="mt-5 text-xs text-[#424665]">Time Remaining: {formatCountdown(secondsLeft)}</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-lg font-bold text-[#1f2130]">{brand}</h1>
          {session?.company_email ? (
            <p className="text-sm text-[#424665]">({session.company_email})</p>
          ) : null}
          <h2 className="mt-6 text-base font-bold text-[#1f2130]">Reason For Request:-</h2>
          <p className="mt-1 text-sm text-[#1f2130]">{reason}</p>
          <div className="mt-6 rounded-md border border-amber-200 bg-[#fbf6e9] px-4 py-4">
            <h3 className="text-center text-lg font-semibold text-[#1f2130]">Signers</h3>
            <div className="mt-3 space-y-1 text-sm text-[#1f2130]">
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
          <p className="mt-6 text-center text-sm text-[#1f2130]">
            Sign Now opens Aadhaar eSign. OTP is sent to the mobile number linked with Aadhaar.
          </p>
          <ErrorText message={error} />
          <button
            type="button"
            disabled={busy}
            onClick={() => void startAadhaarEsign()}
            className="mx-auto mt-4 block rounded-full bg-[#4caf82] px-10 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Sign Now
          </button>
        </div>
      )}
    </div>
  );
}
