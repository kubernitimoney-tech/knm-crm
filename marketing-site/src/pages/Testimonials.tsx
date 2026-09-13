import { TestimonialCard } from '@/components/TestimonialCard';
import { CtaBanner } from '@/components/CtaBanner';
import { SectionHeader } from '@/components/SectionHeader';
import { testimonials } from '@/data/testimonials';

export function TestimonialsPage() {
  return (
    <>
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <SectionHeader
            as="h1"
            align="center"
            eyebrow="Testimonials"
            title="Customer stories"
            description="Hear from salaried professionals who trusted Kuberniti Money for their short-term funding needs."
          />
        </div>
      </section>

      <section className="bg-bg-app py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        eyebrow="Join our customers"
        title="Join thousands of satisfied customers"
        description="Apply today and experience transparent, professional lending."
      />
    </>
  );
}
