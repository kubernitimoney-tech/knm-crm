import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useTitle } from '@/hooks/useTitle';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const DIGIO_FULLSCREEN_STYLE_ID = 'digio-vkyc-fullscreen';

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
    is_iframe?: boolean;
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
      else reject(new Error('Digio verification failed to load.'));
    };
    script.onerror = () => reject(new Error('Digio verification failed to load.'));
    document.body.appendChild(script);
  });
}

function installDigioFullscreenStyles() {
  if (document.getElementById(DIGIO_FULLSCREEN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DIGIO_FULLSCREEN_STYLE_ID;
  style.textContent = `
    [id^="parentdigio-ifm-"] {
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: #eef3fb !important;
    }
    [id^="wrapperdigio-ifm-"] {
      inset: 0 !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
    iframe[id^="digio-ifm-"] {
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
  `;
  document.head.appendChild(style);
}

function prepareDigioIframe() {
  document.querySelectorAll('iframe[id^="digio-ifm-"]').forEach((node) => {
    const iframe = node as HTMLIFrameElement;
    iframe.setAttribute(
      'allow',
      'geolocation *; microphone *; camera *; display-capture *; autoplay *; clipboard-write *',
    );
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.removeAttribute('sandbox');
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function primeCameraMicAndLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      () => undefined,
      () => undefined,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) return;
  void navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => stream.getTracks().forEach((track) => track.stop()))
    .catch(() => undefined);
}

export function PublicVideoKycPage() {
  useTitle('Identity Verification');
  const { requestId } = useParams<{ requestId: string }>();
  const [session, setSession] = useState<PublicVideoKycSession | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [awaitingComplete, setAwaitingComplete] = useState(false);
  const launchGeneration = useRef(0);

  const load = useCallback(
    async (sync = false, force = false) => {
      if (!requestId) return null;
      const query = sync ? `?sync=1${force ? '&force=1' : ''}` : '';
      const { data } = await axios.get<{
        success: boolean;
        data: PublicVideoKycSession;
        message?: string;
      }>(`${API_BASE_URL}/leads/video-kyc/${requestId}/${query}`);
      if (!data.success) throw new Error(data.message || 'Could not load the KYC request.');
      setSession(data.data);
      return data.data;
    },
    [requestId],
  );

  useEffect(() => {
    load()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load the KYC request.');
      })
      .finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!awaitingComplete || session?.completed) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (cancelled) return;
        const row = await load(true, true).catch(() => null);
        if (row?.completed) {
          setAwaitingComplete(false);
          return;
        }
        await sleep(2000);
      }
      if (!cancelled) {
        setAwaitingComplete(false);
        setError('Verification is still processing. Refresh this page in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [awaitingComplete, session?.completed, load]);

  useEffect(() => {
    if (!session || session.completed || awaitingComplete) return;
    if (!session.document_id || !session.identifier || !session.sdk_url) {
      setError('This KYC request is missing Digio details. Ask the team to send a new link.');
      return;
    }

    installDigioFullscreenStyles();
    document.querySelectorAll('[id^="parentdigio-ifm-"]').forEach((node) => node.remove());
    primeCameraMicAndLocation();

    const generation = ++launchGeneration.current;
    const iframeWatcher = window.setInterval(prepareDigioIframe, 300);

    loadDigioSdk(session.sdk_url)
      .then((Digio) => {
        if (generation !== launchGeneration.current) return;
        const digio = new Digio({
          environment: session.environment,
          is_iframe: true,
          is_redirection_approach: false,
          callback: (response) => {
            window.clearInterval(iframeWatcher);
            if (response?.error_code) {
              setError(response.message || 'Verification was not completed.');
              return;
            }
            setAwaitingComplete(true);
          },
        });
        digio.init();
        prepareDigioIframe();
        // No GWT token — Authenticate → Send code to Mobile stays as-is.
        digio.submit(session.document_id, session.identifier);
      })
      .catch((err: unknown) => {
        if (generation !== launchGeneration.current) return;
        window.clearInterval(iframeWatcher);
        setError(err instanceof Error ? err.message : 'Could not start verification.');
      });

    return () => {
      window.clearInterval(iframeWatcher);
    };
  }, [session, load, awaitingComplete]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="h-8" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          {isLoading ? (
            <p className="text-sm text-slate-500 text-center">Opening verification…</p>
          ) : error ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : session?.completed ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-bold text-slate-900">Video KYC Successfully Completed</h1>
              <p className="text-sm text-slate-500">
                A confirmation email has been sent to your registered address.
              </p>
            </div>
          ) : awaitingComplete ? (
            <p className="text-sm text-slate-500 text-center">Saving your verification…</p>
          ) : (
            <p className="text-sm text-slate-500 text-center">Opening Digio Authenticate…</p>
          )}
        </div>
      </div>
    </div>
  );
}
