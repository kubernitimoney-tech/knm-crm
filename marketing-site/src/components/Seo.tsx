import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { brand } from '@/lib/brand';
import { absoluteUrl, getSeoForPath, type SeoRoute } from '@/lib/seo';

type SeoProps = Partial<SeoRoute>;

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
  managed: Set<HTMLElement>,
) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
    managed.add(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, managed: Set<HTMLElement>) {
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
    managed.add(element);
  }
  element.setAttribute('href', href);
}

export function Seo(overrides: SeoProps = {}) {
  const { pathname } = useLocation();
  const seo = { ...getSeoForPath(pathname), ...overrides };
  const canonical = absoluteUrl(seo.path || pathname);
  const ogImage = absoluteUrl('/og-image.png');

  useEffect(() => {
    const managed = new Set<HTMLElement>();
    document.title = seo.title;
    document.documentElement.lang = 'en';

    upsertMeta('name', 'description', seo.description, managed);
    upsertLink('canonical', canonical, managed);

    if (seo.noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow', managed);
    } else {
      upsertMeta('name', 'robots', 'index, follow', managed);
    }

    const gscVerification = import.meta.env.VITE_GSC_VERIFICATION?.trim();
    if (gscVerification) {
      upsertMeta('name', 'google-site-verification', gscVerification, managed);
    }

    upsertMeta('property', 'og:type', 'website', managed);
    upsertMeta('property', 'og:site_name', brand.name, managed);
    upsertMeta('property', 'og:title', seo.title, managed);
    upsertMeta('property', 'og:description', seo.description, managed);
    upsertMeta('property', 'og:url', canonical, managed);
    upsertMeta('property', 'og:image', ogImage, managed);
    upsertMeta('property', 'og:image:width', '1200', managed);
    upsertMeta('property', 'og:image:height', '630', managed);
    upsertMeta('property', 'og:image:alt', `${brand.name} logo`, managed);
    upsertMeta('property', 'og:locale', 'en_IN', managed);

    upsertMeta('name', 'twitter:card', 'summary_large_image', managed);
    upsertMeta('name', 'twitter:title', seo.title, managed);
    upsertMeta('name', 'twitter:description', seo.description, managed);
    upsertMeta('name', 'twitter:image', ogImage, managed);

    return () => {
      for (const element of managed) {
        element.remove();
      }
    };
  }, [seo.title, seo.description, seo.noindex, seo.path, canonical, ogImage, pathname]);

  return null;
}
