import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { ForbiddenPage } from './ForbiddenPage';
import { ServerErrorPage } from './ServerErrorPage';

/**
 * Catches errors thrown while rendering routes (loaders, actions, render errors)
 * and shows the appropriate error page based on the status code.
 */
export const RouteErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <NotFoundPage />;
    if (error.status === 403) return <ForbiddenPage />;

    return (
      <ServerErrorPage
        code={String(error.status)}
        title={error.statusText || 'Something went wrong'}
        detail={typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2)}
      />
    );
  }

  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? ''}`.trim()
      : typeof error === 'string'
        ? error
        : undefined;

  return <ServerErrorPage detail={import.meta.env.DEV ? detail : undefined} />;
};
