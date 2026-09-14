import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { useTitle } from '@/hooks/useTitle';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface PublicVideoKycSession {
  status: string;
  customer_name: string;
  document_id: string;
  identifier: string;
  environment: 'sandbox' | 'production';
  sdk_url: string;
  completed: boolean;
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

function loadDigioSdk(src: string): Promise<DigioConstructor> {
  const current = (window as unknown as { Digio?: DigioConstructor }).Digio;
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { Digio?: DigioConstructor }).Digio;
      if (loaded) resolve(loaded);
      else reject(new Error('Digio verification failed to load.'));
    };
    script.onerror = () => reject(new Error('Digio verification failed to load.'));
    document.body.appendChild(script);
  });
}

export function PublicVideoKycPage() {
  useTitle('Identity Verification');
  const { requestId } = useParams<{ requestId: string }>();
  const [session, setSession] = useState<PublicVideoKycSession | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const load = useCallback(async () => {
    if (!requestId) return;
    const { data } = await axios.get<{
      success: boolean;
      data: PublicVideoKycSession;
      message?: string;
    }>(`${API_BASE_URL}/leads/video-kyc/${requestId}/`);
    if (!data.success) throw new Error(data.message || 'Could not load the KYC request.');
    setSession(data.data);
  }, [requestId]);

  useEffect(() => {
    load()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load the KYC request.');
      })
      .finally(() => setIsLoading(false));
  }, [load]);

  const startVerification = async () => {
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
            setError(response.message || 'Verification was not completed.');
            return;
          }
          load().catch(() => undefined);
        },
      });
      digio.init();
      // Omitting the GWT token keeps Digio's first-factor email/mobile OTP step.
      digio.submit(session.document_id, session.identifier);
    } catch (err: unknown) {
      setIsStarting(false);
      setError(err instanceof Error ? err.message : 'Could not start verification.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="h-8" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          {isLoading ? (
            <p className="text-sm text-slate-500 text-center">Loading verification…</p>
          ) : error && !session ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : session?.completed ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-bold text-slate-900">Verification Completed</h1>
              <p className="text-sm text-slate-500">Your KYC details were submitted successfully.</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
                <h1 className="text-xl font-bold text-slate-900">Identity Verification</h1>
                <p className="text-sm text-slate-500">
                  Complete Aadhaar, PAN, selfie and OCR verification
                  {session?.customer_name ? ` for ${session.customer_name}` : ''}.
                </p>
              </div>
              {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
              <Button
                className="w-full"
                disabled={!session?.document_id || isStarting}
                onClick={() => void startVerification()}
              >
                {isStarting ? 'Opening Digio…' : 'Start Video KYC'}
              </Button>
              <p className="text-[11px] leading-relaxed text-slate-400 text-center">
                You will need your Aadhaar and PAN details and permission to use the camera.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
