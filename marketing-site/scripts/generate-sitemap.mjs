import { readFileSync, writeFileSync } from 'node:fs';
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

const today = new Date().toISOString().slice(0, 10);

const urls = routes
  .map((route) => {
    const loc = route.path === '/' ? `${siteUrl}/` : `${siteUrl}${route.path}`;
    const priority = route.path === '/' ? '1.0' : route.path.startsWith('/blog') ? '0.7' : '0.8';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf8');

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
writeFileSync(join(distDir, 'robots.txt'), robots, 'utf8');
console.log(`Generated sitemap.xml with ${routes.length} URLs at ${siteUrl}`);
