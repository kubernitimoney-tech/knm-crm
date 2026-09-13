import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/personal-loan', label: 'Personal Loan' },
  { to: '/blog', label: 'Blog' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-card-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium transition-colors hover:text-primary-deep',
                  isActive ? 'text-primary-deep' : 'text-mid-shade',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/apply" className="btn-primary !px-5 !py-2.5 text-sm">
            Apply Now
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-primary-deep lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-card-border bg-white px-4 py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-bg-app text-primary-deep' : 'text-mid-shade',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link to="/apply" className="btn-primary mt-2 text-center" onClick={() => setMobileOpen(false)}>
              Apply Now
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
