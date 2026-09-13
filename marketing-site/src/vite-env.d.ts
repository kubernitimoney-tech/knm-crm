/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BRAND_NAME: string;
  readonly VITE_SUPPORT_EMAIL: string;
  readonly VITE_SUPPORT_PHONE: string;
  readonly VITE_WHATSAPP_NUMBER: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_GTM_ID?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GSC_VERIFICATION?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
