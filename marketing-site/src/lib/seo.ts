import seoRoutes from '@/data/seo-routes.json';
import blogSeo from '@/data/blog-seo.json';
import { brand } from '@/lib/brand';

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
}

export const SEO_ROUTES = [...seoRoutes, ...blogSeo] as SeoRoute[];

const NOT_FOUND_SEO: SeoRoute = {
  path: '/404',
  title: `Page not found | ${brand.name}`,
  description: 'The page you are looking for does not exist or may have moved.',
  noindex: true,
};

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getSeoForPath(pathname: string): SeoRoute {
  const path = normalizePath(pathname);
  return SEO_ROUTES.find((route) => route.path === path) ?? NOT_FOUND_SEO;
}

export function absoluteUrl(pathname: string): string {
  const base = brand.siteUrl.replace(/\/$/, '');
  if (!pathname || pathname === '/') {
    return `${base}/`;
  }
  return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
