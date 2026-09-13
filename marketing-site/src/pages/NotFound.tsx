import { Link } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';

export function NotFoundPage() {
  return (
    <PageHero
      eyebrow="Error 404"
      title="Page not found"
      description="The page you are looking for doesn’t exist or may have moved. Head back home or apply for a personal loan."
      image="/illustrations/404-1.svg"
      imageAlt="Page not found illustration"
      actions={
        <>
          <Link to="/" className="btn-primary">
            Go to Home
          </Link>
          <Link to="/apply" className="btn-secondary">
            Apply Now
          </Link>
        </>
      }
    />
  );
}
