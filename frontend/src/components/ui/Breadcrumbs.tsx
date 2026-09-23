import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  isBreadcrumbLinkable,
  resolveBreadcrumbLabel,
} from '@/constants/breadcrumbLabels';

interface BreadcrumbsProps {
  segmentLabels?: Record<string, string>;
}

export const Breadcrumbs = ({ segmentLabels }: BreadcrumbsProps) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"
    >
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const formattedName = resolveBreadcrumbLabel(pathnames, index, segmentLabels);
        const canLink = !isLast && isBreadcrumbLinkable(routeTo);

        return (
          <React.Fragment key={routeTo}>
            {index > 0 && (
              <ChevronRight size={12} className="shrink-0 text-slate-300 dark:text-slate-600" />
            )}
            {isLast ? (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formattedName}
              </span>
            ) : canLink ? (
              <Link
                to={routeTo}
                className="transition-colors hover:text-primary-deep dark:hover:text-slate-200"
              >
                {formattedName}
              </Link>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">{formattedName}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
