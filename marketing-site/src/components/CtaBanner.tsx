import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface CtaBannerProps {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function CtaBanner({
  eyebrow = 'Next step',
  title = 'Ready to get started?',
  description = 'Apply in minutes and our team will contact you shortly.',
}: CtaBannerProps) {
  return (
    <section
      data-surface="dark"
      className="bg-gradient-to-br from-primary-deep via-secondary-dark to-primary-deep py-12 text-white md:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lighter-gray">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-lighter-gray md:text-base">{description}</p>
        <Link to="/apply" className="btn-primary mt-8 inline-flex bg-white !text-primary-deep hover:!bg-bg-app">
          Apply Now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
