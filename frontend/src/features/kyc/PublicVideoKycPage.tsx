import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, MapPin } from 'lucide-react';
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
  /** True until the customer's latitude/longitude is on record. */
  location_required?: boolean;
}

type LocationStatus =
  | 'checking'
  | 'needed'
  | 'requesting'
  | 'saving'
  | 'denied'
  | 'off'
  | 'unsupported'
  | 'error'
  | 'ok';

const LOCATION_MESSAGES: Record<Exclude<LocationStatus, 'ok'>, { title: string; body: string }> = {
  checking: { title: 'Checking location…', body: 'Please wait a moment.' },
  needed: {
    title: 'Allow location access',
    body: 'We need your current location to complete Video KYC. Tap the button below and choose Allow when your browser asks.',
  },
  requesting: { title: 'Getting your location…', body: 'Keep this page open. This can take a few seconds.' },
  saving: { title: 'Saving your location…', body: 'Please wait.' },
  denied: {
    title: 'Location access is blocked',
    body: 'Allow Location for this page in your browser settings, then tap Try again. Android (Chrome): tap the lock icon in the address bar → Permissions → Location → Allow. iPhone: Settings → Safari → Location → Allow.',
  },
  off: {
    title: 'Turn on your location',
    body: "We couldn't find your location. Turn on Location (GPS) on your phone, then tap Try again.",
  },
  unsupported: {
    title: 'Location not available',
    body: 'This browser cannot share your location. Open this link in Chrome or Safari on your phone.',
  },
  error: {
    title: 'Could not save your location',
    body: 'Check your internet connection and tap Try again.',
  },
};

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
  // Step 1 (OTP + DigiLocker) done, video not recorded yet.
  const [videoPending, setVideoPending] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking');
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

  const requestLocation = useCallback(() => {
    if (!requestId) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus('saving');
        axios
          .post(`${API_BASE_URL}/leads/video-kyc/${requestId}/location/`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
          .then(() => load())
          .then(() => setLocationStatus('ok'))
          .catch(() => setLocationStatus('error'));
      },
      (geoError) => {
        setLocationStatus(geoError.code === geoError.PERMISSION_DENIED ? 'denied' : 'off');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, [requestId, load]);

  // Decide whether the location step is needed once the session is known.
  useEffect(() => {
    if (!session || locationStatus !== 'checking') return;
    if (session.completed || !session.location_required) {
      setLocationStatus('ok');
      return;
    }
    const permissions = navigator.permissions;
    if (!permissions?.query) {
      setLocationStatus('needed');
      return;
    }
    permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') requestLocation();
        else setLocationStatus(result.state === 'denied' ? 'denied' : 'needed');
      })
      .catch(() => setLocationStatus('needed'));
  }, [session, locationStatus, requestLocation]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    load()
      .then((row) => {
        if (row?.status === 'video_pending') setVideoPending(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load the KYC request.');
      })
      .finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (!awaitingComplete || session?.completed) return;
    let cancelled = false;
    void (async () => {
      let last: PublicVideoKycSession | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (cancelled) return;
        const row = await load(true).catch(() => null);
        last = row ?? last;
        if (row?.completed) {
          setAwaitingComplete(false);
          return;
        }
        await sleep(2000);
      }
      if (!cancelled) {
        if (last?.status === 'video_pending') {
          setVideoPending(true);
          setAwaitingComplete(false);
          return;
        }
        setAwaitingComplete(false);
        setError('Verification is still processing. Refresh this page in a moment.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [awaitingComplete, session?.completed, load]);

  useEffect(() => {
    if (!session || session.completed || awaitingComplete || videoPending) return;
    if (locationStatus !== 'ok') return;
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
  }, [session, load, awaitingComplete, videoPending, locationStatus]);

  return (
    <div className="public-guest-page min-h-screen bg-[#f4f6f9] text-[#1f2130] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="h-8" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          {isLoading ? (
            <p className="text-sm text-slate-500 text-center">Opening verification…</p>
          ) : error ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : session && !session.completed && locationStatus !== 'ok' ? (
            <div className="text-center space-y-3">
              <MapPin className="mx-auto h-10 w-10 text-[#2A2D4F]" />
              <h1 className="text-lg font-bold text-slate-900">{LOCATION_MESSAGES[locationStatus].title}</h1>
              <p className="text-sm text-slate-500">{LOCATION_MESSAGES[locationStatus].body}</p>
              {['needed', 'denied', 'off', 'error'].includes(locationStatus) ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2A2D4F] px-5 text-sm font-semibold text-white hover:bg-[#2A2D4F]/90"
                  onClick={requestLocation}
                >
                  {locationStatus === 'needed' ? 'Allow location' : 'Try again'}
                </button>
              ) : null}
            </div>
          ) : session?.completed ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-bold text-slate-900">Video KYC Successfully Completed</h1>
              <p className="text-sm text-slate-500">
                A confirmation email has been sent to your registered address.
              </p>
            </div>
          ) : videoPending ? (
            <div className="text-center space-y-3">
              <h1 className="text-lg font-bold text-slate-900">One step left</h1>
              <p className="text-sm text-slate-500">
                Your documents are verified. Record your 1-minute video to complete Video KYC.
              </p>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2A2D4F] px-5 text-sm font-semibold text-white hover:bg-[#2A2D4F]/90"
                onClick={() => setVideoPending(false)}
              >
                Continue to video
              </button>
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
