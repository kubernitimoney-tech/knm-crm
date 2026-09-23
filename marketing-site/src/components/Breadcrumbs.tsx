import { Link, useLocation } from 'react-router-dom';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, getBreadcrumbs } from '@/lib/seo-schemas';

const HIDDEN_BREADCRUMB_PATHS = new Set(['/apply']);

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);
  if (crumbs.length <= 1) return null;

  const path = pathname.replace(/\/+$/, '') || '/';
  const hideNav = HIDDEN_BREADCRUMB_PATHS.has(path);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {hideNav ? null : (
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-mid-shade">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {isLast ? (
                    <span aria-current="page" className="font-medium text-primary-deep">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-primary-deep hover:underline">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </>
  );
}
