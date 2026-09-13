import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { cn } from '@/lib/utils';

const IMAGE_INTERVAL_MS = 4000;

const services = [
  {
    id: 'shopping-loan',
    title: 'Shopping Loan',
    description:
      'Shopping loan is just one click away from your application submission and document sharing. Do it now and get up to a higher credit limit loan amount.',
    images: [
      '/shopping-loan/shopping-1.svg',
      '/shopping-loan/shopping-2.svg',
      '/shopping-loan/shopping-3.svg',
    ],
  },
  {
    id: 'travel-loan',
    title: 'Travel Loan',
    description:
      'Why are you cancelling your trips due to low budget? Get instant travel loan approval within one hour with a 100% online process from Kuberniti Money.',
    images: [
      '/travel-loan/travel-1.svg',
      '/travel-loan/travel-2.svg',
      '/travel-loan/travel-3.svg',
    ],
  },
  {
    id: 'emergency-loan',
    title: 'Emergency Loan',
    description:
      'Kuberniti Money offers instant loan for unexpected expense to salaried persons. Apply in a few steps and get funds credited to your account.',
    images: [
      '/medical-emergency-loan/medical-emergency-loan-1.svg',
      '/medical-emergency-loan/medical-emergency-loan-2.svg',
      '/medical-emergency-loan/medical-emergency-loan-3.svg',
    ],
  },
  {
    id: 'clear-bills',
    title: 'Loan for Clear Bill',
    description:
      'Pay all your pending bills and outstanding dues with a collateral-free personal loan. Avoid late payment penalties with Kuberniti Money.',
    images: [
      '/clear-bills/clear-bills-1.svg',
      '/clear-bills/clear-bills-2.svg',
      '/clear-bills/clear-bills-3.svg',
    ],
  },
  {
    id: 'home-renovation',
    title: 'Home Renovation',
    description:
      'No worry about your home renovation. Here is Kuberniti Money for every salaried person with a 100% online process.',
    images: [
      '/home-renovation/home-renovation-1.svg',
      '/home-renovation/home-renovation-2.svg',
      '/home-renovation/home-renovation-3.svg',
    ],
  },
  {
    id: 'salary-advance-loan',
    title: 'Salary Advance Loan',
    description:
      'Why are you waiting for the next salary day? Take an advance salary loan from Kuberniti Money with a 100% online process and no hidden charges.',
    images: [
      '/salary-advance-loan/salary-advance-loan-1.svg',
      '/salary-advance-loan/salary-advance-loan-2.svg',
      '/salary-advance-loan/salary-advance-loan-3.svg',
    ],
  },
] as const;

function ServiceCard({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const delay = window.setTimeout(() => setReady(true), index * 400);
    return () => window.clearTimeout(delay);
  }, [index]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % service.images.length);
    }, IMAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, service.images.length]);

  return (
    <article className="group relative min-h-[280px] overflow-hidden rounded-2xl border border-card-border shadow-sm sm:min-h-[300px]">
      {/* Background images */}
      <div className="absolute inset-0 bg-bg-app">
        {service.images.map((src, imageIndex) => {
          const isActive = imageIndex === active;
          return (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden={!isActive}
              className={cn(
                'absolute inset-0 h-full w-full object-contain object-center p-6 transition-all duration-700 ease-out sm:p-8',
                isActive ? 'service-image-zoom opacity-100' : 'scale-95 opacity-0',
              )}
              loading={imageIndex === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          );
        })}
      </div>

      {/* Readability scrim — text stays in front */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary-deep/90 via-primary-deep/45 to-primary-deep/10" />

      {/* Foreground content */}
      <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-end p-5 sm:min-h-[300px] sm:p-6">
        <p className="text-[11px] font-bold tracking-wider text-white/60">
          {String(index + 1).padStart(2, '0')}
        </p>
        <h3 className="mt-1 text-xl font-bold text-white">{service.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/85">
          {service.description}
        </p>
        <Link
          to="/apply"
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-primary-deep transition-transform hover:-translate-y-0.5"
        >
          Apply Now
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </article>
  );
}

export function OurServices() {
  return (
    <section id="our-services" className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          eyebrow="What we offer"
          title="Our services"
          description="Loan options for salaried professionals — apply online in minutes."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <ServiceCard key={service.id} service={service} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
