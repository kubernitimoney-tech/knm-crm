import React, { useState, useEffect, useMemo } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { getApiErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field-label';
import { useAuthStore } from '@/store/useAuthStore';
import { enterPlaceholder } from '@/lib/placeholders';
import {
  EMPLOYEE_MOTIVATION_HIGHLIGHTS,
  pickEmployeeMotivationLine,
} from '@/constants/employeeMotivation';

export const LoginPage = () => {
  useTitle('Login');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const from = (location.state as { from?: string; message?: string } | null)?.from ?? '/';
  const sessionMessage = (location.state as { message?: string } | null)?.message;
  const dailyMotivation = useMemo(() => pickEmployeeMotivationLine(), []);

  useEffect(() => {
    if (sessionMessage) {
      setError(sessionMessage);
    }
  }, [sessionMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary-deep via-secondary-dark to-primary-deep text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-10">
          <div className="mb-12">
            <Logo to="/" src="/logo/logo.png" imageClassName="h-12 max-h-12 w-auto max-w-[220px]" />
          </div>

          <div className="space-y-6 max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Employee workspace
            </p>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Your work powers every sanction, disbursal, and recovery.
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              This portal is built for our internal team — to serve customers faster, stay compliant,
              and grow together.
            </p>
            <ul className="space-y-3 pt-2">
              {EMPLOYEE_MOTIVATION_HIGHLIGHTS.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-white/85">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-200" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-medium text-white/50">
          <p>Copyright © 2026 kubernitimoney - All Rights Reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-primary-deep tracking-tight">Welcome back, team</h2>
            <p className="text-slate-500 text-sm mt-2 font-medium">
              Sign in with your work email to access the employee portal
            </p>
            <p className="text-slate-500 text-xs mt-3 italic leading-relaxed border-l-2 border-primary-deep/20 pl-3">
              {dailyMotivation}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <FieldLabel variant="dialog" htmlFor="email" required>
                Email Address
              </FieldLabel>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder={enterPlaceholder('Email Address')}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-12 bg-white border-slate-200 rounded-xl focus-visible:ring-primary-deep/10 text-sm font-medium transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <FieldLabel variant="dialog" htmlFor="password" required>
                  Password
                </FieldLabel>
                <Link to="/recover-password" className="text-[11px] font-bold text-primary-deep hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={enterPlaceholder('Password')}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-12 pr-12 bg-white border-slate-200 rounded-xl focus-visible:ring-primary-deep/10 text-sm font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-deep transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-primary-deep to-secondary-dark text-white rounded-xl font-bold shadow-xl shadow-primary-deep/20 hover:scale-[1.01] active:scale-95 transition-all text-sm group"
            >
              {isLoading ? 'Authenticating...' : (
                <span className="flex items-center gap-2">
                  Sign In to Dashboard
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          {/*<div className="pt-4 text-center">
            <p className="text-xs text-slate-400 font-medium italic">
              Demo: <span className="font-bold not-italic text-slate-600">admin@lms.local</span> / Admin@123
            </p>
          </div>*/}
        </div>
      </div>
    </div>
  );
};
