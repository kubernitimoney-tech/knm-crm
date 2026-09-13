import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/pages/Landing';
import { allLoanSlugs } from '@/data/loan-products';

const ApplyPage = lazy(() => import('@/pages/Apply').then((m) => ({ default: m.ApplyPage })));
const TestimonialsPage = lazy(() =>
  import('@/pages/Testimonials').then((m) => ({ default: m.TestimonialsPage })),
);
const FaqPage = lazy(() => import('@/pages/FAQ').then((m) => ({ default: m.FaqPage })));
const AboutPage = lazy(() => import('@/pages/About').then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('@/pages/Contact').then((m) => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/pages/Terms').then((m) => ({ default: m.TermsPage })));
const LoanProductRoutePage = lazy(() =>
  import('@/pages/LoanProductRoutePage').then((m) => ({ default: m.LoanProductRoutePage })),
);
const BlogIndexPage = lazy(() => import('@/pages/BlogIndex').then((m) => ({ default: m.BlogIndexPage })));
const BlogPostPage = lazy(() => import('@/pages/BlogPost').then((m) => ({ default: m.BlogPostPage })));
const EmiCalculatorPage = lazy(() =>
  import('@/pages/EmiCalculator').then((m) => ({ default: m.EmiCalculatorPage })),
);
const CibilScorePage = lazy(() =>
  import('@/pages/CibilScore').then((m) => ({ default: m.CibilScorePage })),
);
const TrackPage = lazy(() => import('@/pages/Track').then((m) => ({ default: m.TrackPage })));
const NotFoundPage = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })),
);

function PageLoader() {
  return <div className="mx-auto max-w-6xl px-4 py-20 text-center text-mid-shade">Loading...</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="apply" element={<ApplyPage />} />
            {allLoanSlugs.map((slug) => (
              <Route key={slug} path={slug} element={<LoanProductRoutePage />} />
            ))}
            <Route path="emi-calculator" element={<EmiCalculatorPage />} />
            <Route path="cibil-score" element={<CibilScorePage />} />
            <Route path="track" element={<TrackPage />} />
            <Route path="blog" element={<BlogIndexPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="testimonials" element={<TestimonialsPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
