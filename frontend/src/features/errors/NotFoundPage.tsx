import { Compass } from 'lucide-react';
import { ErrorLayout } from './ErrorLayout';

export const NotFoundPage = () => {
  return (
    <ErrorLayout
      code="404"
      title="Page not found"
      icon={Compass}
      accent="sky"
      description="The page you're looking for doesn't exist, was moved, or the link is broken. Check the address or head back to your dashboard."
    />
  );
};
