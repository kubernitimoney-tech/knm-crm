import React, { useState, useRef, useEffect } from 'react';
import { useTitle } from '@/hooks/useTitle';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle2, Lock, Timer, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field-label';
import { enterPlaceholder } from '@/lib/placeholders';

type RecoveryStep = 'email' | 'otp' | 'success';

export const RecoverPasswordPage = () => {
  useTitle('Recover Password');
  const navigate = useNavigate();
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'otp' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
      setTimeLeft(120);
    }, 1500);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep('success');
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary-deep rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary-dark rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[460px] z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white p-8 md:p-12 rounded-[32px] shadow-2xl shadow-slate-200/40 border border-slate-100 min-h-[500px] flex flex-col">
          <div className="mb-8 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-500 scale-100 ${
              step === 'success' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100' : 'bg-primary-deep/5 text-primary-deep shadow-inner'
            }`}>
              {step === 'success' ? <CheckCircle2 size={32} /> : <ShieldCheck size={32} />}
            </div>

            {step === 'email' && (
              <>
                <h2 className="text-2xl font-black text-primary-deep tracking-tight">Recovery</h2>
                <p className="text-slate-500 text-sm mt-3 font-medium leading-relaxed">
                  Enter your registered email address to receive a verification code.
                </p>
              </>
            )}

            {step === 'otp' && (
              <>
                <h2 className="text-2xl font-black text-primary-deep tracking-tight">Verify Identity</h2>
                <p className="text-slate-500 text-sm mt-3 font-medium leading-relaxed">
                  We've sent a 6-digit code to <br /><span className="text-secondary-dark font-bold font-mono text-[13px]">{email || 'your-email@company.com'}</span>
                </p>
              </>
            )}

            {step === 'success' && (
              <>
                <h2 className="text-2xl font-black text-emerald-600 tracking-tight">Password Sent!</h2>
                <p className="text-slate-500 text-sm mt-3 font-medium leading-relaxed">
                  Your temporary credentials have been sent to your email. Please use them to login and update your password.
                </p>
              </>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
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
                      className="h-14 pl-12 bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary-deep/10 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-primary-deep to-secondary-dark text-white rounded-2xl font-bold shadow-xl shadow-primary-deep/20 hover:scale-[1.01] active:scale-95 transition-all text-sm"
                >
                  {isLoading ? 'Processing...' : 'Send Verification Code'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="flex justify-between gap-1.5 px-1">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      placeholder={enterPlaceholder('OTP')}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-[50px] h-[64px] text-center text-2xl font-black text-primary-deep bg-white border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-primary-deep/5 focus:border-primary-deep/40 outline-none transition-all placeholder:text-slate-100"
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <Button
                    type="submit"
                    disabled={isLoading || otp.some(d => !d)}
                    className="w-full h-14 bg-gradient-to-r from-primary-deep to-secondary-dark text-white rounded-2xl font-bold shadow-xl shadow-primary-deep/20 hover:scale-[1.01] active:scale-95 transition-all text-sm"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Verify & Continue'}
                  </Button>

                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => setStep('email')}
                      className="text-xs font-bold text-slate-400 hover:text-primary-deep transition-colors"
                    >
                      Change Email
                    </button>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                      <Timer size={14} className={timeLeft < 30 ? "text-rose-500 animate-pulse" : ""} />
                      <span className={timeLeft < 30 ? "text-rose-600" : ""}>{formatTime(timeLeft)}</span>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:scale-[1.01] active:scale-95 transition-all text-sm"
                >
                  Back to Sign In
                </Button>
                <p className="text-center text-[11px] text-slate-400 font-medium">
                  Haven't received yet? <button className="text-primary-deep font-bold hover:underline">Check Spam</button> or <button className="text-primary-deep font-bold hover:underline">Resend</button>
                </p>
              </div>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-center">
            <Link
              to="/login"
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-primary-deep transition-all group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 text-[10px] font-bold text-slate-300 uppercase tracking-[5px] select-none">
        <div className="w-12 h-[1px] bg-slate-200" />
        Secure Portal
        <div className="w-12 h-[1px] bg-slate-200" />
      </div>
    </div>
  );
};
