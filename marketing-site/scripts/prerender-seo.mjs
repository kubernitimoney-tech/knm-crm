import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

const siteUrl = (process.env.VITE_SITE_URL || 'http://localhost:3001').replace(/\/$/, '');
const routes = [
  ...JSON.parse(readFileSync(join(root, 'src/data/seo-routes.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(root, 'src/data/blog-seo.json'), 'utf8')),
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildCanonical(path) {
  return path === '/' ? `${siteUrl}/` : `${siteUrl}${path}`;
}

function organizationJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kuberniti Money',
    url: `${siteUrl}/`,
    logo: `${siteUrl}/og-image.png`,
  });
}

function injectSeo(html, route) {
  const canonical = buildCanonical(route.path);
  const ogImage = `${siteUrl}/og-image.png`;
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);

  let output = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  output = output.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`,
  );

  const seoTags = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kuberniti Money" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Kuberniti Money logo" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${organizationJsonLd()}</script>
  `;

  return output.replace('</head>', `${seoTags}</head>`);
}

function writeRouteHtml(route, html) {
  if (route.path === '/') {
    writeFileSync(join(distDir, 'index.html'), html, 'utf8');
    return;
  }

  const segments = route.path.split('/').filter(Boolean);
  const routeDir = join(distDir, ...segments);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'index.html'), html, 'utf8');
}

const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

for (const route of routes) {
  writeRouteHtml(route, injectSeo(baseHtml, route));
}

console.log(`Prerendered SEO HTML for ${routes.length} routes into ${distDir}`);
