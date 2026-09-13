import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Chatbot } from '@/components/Chatbot';
import { ScrollToTop, ScrollToTopButton } from '@/components/ScrollToTop';
import { Seo } from '@/components/Seo';
import { Analytics } from '@/components/Analytics';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <Analytics />
      <Seo key={pathname} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-primary-deep"
      >
        Skip to main content
      </a>
      <ScrollToTop />
      <Header />
      <Breadcrumbs />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
      <ScrollToTopButton />
    </div>
  );
}
