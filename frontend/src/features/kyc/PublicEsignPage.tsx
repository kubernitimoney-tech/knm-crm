import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, FileText } from 'lucide-react';
import { useTitle } from '@/hooks/useTitle';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface PublicEsignSession {
  id: string;
  status: string;
  sign_type: 'aadhaar' | 'electronic';
  document_name: string;
  customer_name: string;
  signing_url: string | null;
  document_id: string;
  identifier: string;
  access_token: string;
  environment: 'sandbox' | 'production';
  sdk_url: string;
  document_url: string;
  signed: boolean;
  signed_file_url: string | null;
}

interface DigioInstance {
  init: () => void;
  submit: (documentId: string, identifier: string, token?: string) => void;
}

interface DigioConstructor {
  new (options: {
    environment: string;
    callback: (response: { error_code?: string; message?: string }) => void;
  }): DigioInstance;
}

function getDigioConstructor(): DigioConstructor | null {
  const ctor = (window as unknown as { Digio?: DigioConstructor }).Digio;
  return ctor ?? null;
}

function loadDigioSdk(src: string): Promise<DigioConstructor> {
  const existing = getDigioConstructor();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const ctor = getDigioConstructor();
      if (ctor) resolve(ctor);
      else reject(new Error('Digio signing failed to load.'));
    };
    script.onerror = () => reject(new Error('Digio signing failed to load.'));
    document.body.appendChild(script);
  });
}

export function PublicEsignPage() {
  useTitle('Document Signing');
  const { esignId } = useParams<{ esignId: string }>();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<PublicEsignSession | null>(null);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const load = useCallback(async () => {
    if (!esignId) return;
    const { data } = await axios.get<{ success: boolean; data: PublicEsignSession; message?: string }>(
      `${API_BASE_URL}/leads/esign/${esignId}/`,
    );
    if (!data.success) {
      throw new Error(data.message || 'Could not load the signing request.');
    }
    setSession(data.data);
  }, [esignId]);

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load the signing request.');
      })
      .finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if ((!searchParams.get('done') && (!session || session.signed)) || !esignId) return;
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [esignId, load, searchParams, session]);

  const startSigning = async () => {
    if (!session?.document_id || !session.identifier || !session.sdk_url) return;
    setError('');
    setIsStarting(true);
    try {
      const Digio = await loadDigioSdk(session.sdk_url);
      const digio = new Digio({
        environment: session.environment,
        callback: (response) => {
          setIsStarting(false);
          if (response?.error_code) {
            setError(response.message || 'Signing was not completed.');
            return;
          }
          load().catch(() => undefined);
        },
      });
      digio.init();
      if (session.access_token) {
        digio.submit(session.document_id, session.identifier, session.access_token);
      } else {
        digio.submit(session.document_id, session.identifier);
      }
    } catch (err: unknown) {
      setIsStarting(false);
      setError(err instanceof Error ? err.message : 'Could not start signing.');
    }
  };

  const downloadUrl = session?.signed_file_url || session?.document_url;
  const canContinue = Boolean(session?.document_id && session.identifier);
  const signMethod =
    session?.sign_type === 'aadhaar' ? 'Aadhaar number and OTP' : 'email OTP';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="h-8" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          {isLoading ? (
            <p className="text-sm text-slate-500 text-center">Loading document…</p>
          ) : error && !session ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : session?.signed ? (
            <>
              <div className="text-center space-y-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h1 className="text-xl font-bold text-slate-900">Signed Successfully</h1>
                <p className="text-sm text-slate-500">
                  Your document has been electronically signed.
                </p>
              </div>
              {downloadUrl ? (
                <Button
                  className="w-full"
                  onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                >
                  Download
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold text-slate-900">Document Signing</h1>
                <p className="text-xs text-slate-400">
                  Review document → {signMethod} → signed
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {session?.document_name || 'Agreement.pdf'}
                  </p>
                  {session?.customer_name ? (
                    <p className="text-xs text-slate-500">{session.customer_name}</p>
                  ) : null}
                </div>
              </div>
              {session?.document_url ? (
                <a
                  href={session.document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Review Document
                </a>
              ) : null}
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I have reviewed this document
              </label>
              {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
              <Button
                className="w-full"
                disabled={!reviewed || !canContinue || isStarting}
                onClick={() => {
                  void startSigning();
                }}
              >
                {isStarting ? 'Opening…' : 'Continue'}
              </Button>
              <p className="text-[11px] leading-relaxed text-slate-400 text-center">
                Continue opens Digio for {signMethod}. No Digio account or password is required.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
