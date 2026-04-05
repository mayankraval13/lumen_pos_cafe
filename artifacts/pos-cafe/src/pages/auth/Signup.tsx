import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { ApiError, useSignup, useRequestSignupOtp } from '@workspace/api-client-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Coffee, ArrowRight, ArrowLeft, Mail, ShieldCheck, Eye, EyeOff,
  CheckCircle2, User, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const SIGNUP_OTP_ALLOWED_EMAIL = 'iammayankraval@gmail.com';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailStepSchema = z.object({
  email: z.string().email('Enter a valid email'),
}).refine((d) => normalizeEmail(d.email) === SIGNUP_OTP_ALLOWED_EMAIL, {
  message: 'Sign up is only available for the authorized email address.',
  path: ['email'],
});

const accountStepSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'CASHIER']),
});

type EmailStepValues = z.infer<typeof emailStepSchema>;
type AccountStepValues = z.infer<typeof accountStepSchema>;

type WizardStep = 1 | 2 | 3;

function toastApiError(err: unknown, fallback: string): void {
  if (err instanceof ApiError) {
    const d = err.data as { error?: string } | null | undefined;
    if (d && typeof d.error === 'string' && d.error.trim()) {
      toast.error(d.error.trim());
      return;
    }
  }
  const msg = err instanceof Error ? err.message : fallback;
  const short = msg.replace(/^HTTP \d+[^\n]*?:\s*/i, '').trim();
  toast.error(short || fallback);
}

const STEPS = [
  { num: 1, label: 'Email' },
  { num: 2, label: 'Verify' },
  { num: 3, label: 'Account' },
] as const;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const signupMutation = useSignup();
  const requestOtpMutation = useRequestSignupOtp();

  const [step, setStep] = useState<WizardStep>(1);
  const [savedEmail, setSavedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const emailForm = useForm<EmailStepValues>({
    resolver: zodResolver(emailStepSchema),
    defaultValues: { email: '' },
  });

  const accountForm = useForm<AccountStepValues>({
    resolver: zodResolver(accountStepSchema),
    defaultValues: { name: '', password: '', role: 'ADMIN' },
  });

  useEffect(() => {
    if (step === 2) otpRefs.current[0]?.focus();
  }, [step]);

  const otpValue = otp.join('');

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      digits.forEach((d, i) => { if (i < 6) next[i] = d; });
      setOtp(next);
      const focusIdx = Math.min(digits.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const sendCode = (email: string) => {
    const norm = normalizeEmail(email);
    requestOtpMutation.mutate(
      { data: { email: norm } },
      {
        onSuccess: () => {
          setSavedEmail(norm);
          setStep(2);
          toast.success('Verification code sent! Check your inbox.');
        },
        onError: (error: unknown) => {
          toastApiError(error, 'Could not send verification email');
        },
      }
    );
  };

  const onEmailStepSubmit = (data: EmailStepValues) => sendCode(data.email);

  const onContinueWithCode = () => {
    if (!/^\d{6}$/.test(otpValue)) {
      toast.error('Enter the 6-digit code from your email.');
      return;
    }
    setStep(3);
  };

  const onAccountSubmit = (data: AccountStepValues) => {
    signupMutation.mutate(
      {
        data: {
          name: data.name,
          email: savedEmail,
          password: data.password,
          role: data.role,
          otp: otpValue,
        },
      },
      {
        onSuccess: (response) => {
          login(response.token, response.user);
          toast.success('Account created!');
          setLocation('/backend/reporting');
        },
        onError: (error: unknown) => {
          toastApiError(error, 'Failed to create account');
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex font-sans tracking-tight bg-[#f5f5f0]">
      {/* Left image panel */}
      <div className="hidden lg:block lg:w-[55%] xl:w-[55%] relative overflow-hidden">
        <img
          src="/auth-hero.png"
          alt="Lumen POS receipt"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        <div className="absolute top-8 left-8 z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#ecfe8d] rounded-lg flex items-center justify-center shadow-lg">
            <Coffee className="w-[18px] h-[18px] text-[#2d2f2f]" />
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight drop-shadow-md">Lumen POS</span>
        </div>
        <div className="absolute bottom-8 left-8 right-8 z-10">
          <p className="text-white/90 text-2xl font-extrabold leading-snug drop-shadow-md">
            Get started in<br />under a minute.
          </p>
          <p className="text-white/60 text-sm mt-2 drop-shadow-sm">
            Orders &middot; Tables &middot; Kitchen &middot; Payments
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 min-h-screen overflow-y-auto">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-[#2d2f2f] rounded-xl flex items-center justify-center">
                <Coffee className="w-5 h-5 text-[#ecfe8d]" />
              </div>
              <span className="text-[#2d2f2f] font-extrabold text-xl tracking-tight">Lumen POS</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-[28px] font-extrabold text-[#2d2f2f] tracking-tight leading-tight">Create account</h2>
            <p className="text-[#7a7c7c] mt-1.5 text-[15px]">
              {step === 1 && 'Enter your email to get started'}
              {step === 2 && 'Enter the code we sent to your email'}
              {step === 3 && 'Set up your profile to finish'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center mb-7">
            {STEPS.map(({ num, label }, i) => (
              <React.Fragment key={num}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    step > num
                      ? 'bg-[#2d2f2f] text-white'
                      : step === num
                        ? 'bg-[#2d2f2f] text-white ring-4 ring-[#2d2f2f]/10'
                        : 'bg-[#e5e5e0] text-[#b0b0a8]'
                  }`}>
                    {step > num ? <CheckCircle2 className="w-3.5 h-3.5" /> : num}
                  </div>
                  <span className={`text-[11px] font-semibold hidden sm:block ${step >= num ? 'text-[#2d2f2f]' : 'text-[#b0b0a8]'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-[2px] mx-3 rounded-full transition-colors ${step > num ? 'bg-[#2d2f2f]' : 'bg-[#e5e5e0]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Email */}
          {step === 1 && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailStepSubmit)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0a8]" />
                          <Input
                            className="h-12 pl-10 pr-4 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-[#2d2f2f]/10 focus-visible:border-[#2d2f2f]/30 transition-all placeholder:text-[#b0b0a8]"
                            placeholder={SIGNUP_OTP_ALLOWED_EMAIL}
                            type="email"
                            autoComplete="email"
                            {...field}
                            data-testid="input-signup-email"
                          />
                        </div>
                      </FormControl>
                      <p className="text-[11px] text-[#b0b0a8] mt-1">
                        We'll send a 6-digit verification code to this address
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-[15px] font-bold bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white transition-all active:scale-[0.98] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.08)]"
                  disabled={requestOtpMutation.isPending}
                  data-testid="button-signup-send-code"
                >
                  {requestOtpMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending code…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-[#e5e5e0] p-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="w-9 h-9 rounded-lg bg-[#f0f0eb] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-[18px] h-[18px] text-[#2d2f2f]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#2d2f2f]">Check your inbox</p>
                  <p className="text-[11px] text-[#7a7c7c] truncate">
                    Code sent to <span className="font-semibold text-[#2d2f2f]">{savedEmail}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[13px] font-semibold text-[#2d2f2f] block mb-3">Verification code</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <React.Fragment key={i}>
                      <input
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={i === 0 ? 6 : 1}
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        className="w-12 h-[52px] text-center text-xl font-bold text-[#2d2f2f] bg-white border-2 border-[#e5e5e0] rounded-xl focus:outline-none focus:border-[#2d2f2f] focus:ring-2 focus:ring-[#2d2f2f]/10 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        data-testid={`input-signup-otp-${i}`}
                      />
                      {i === 2 && <div className="w-2.5 flex items-center justify-center text-[#e5e5e0] text-lg font-bold">&ndash;</div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-12 rounded-xl text-[15px] font-bold bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white transition-all active:scale-[0.98] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.08)]"
                onClick={onContinueWithCode}
                disabled={otpValue.length < 6}
                data-testid="button-signup-continue-code"
              >
                <span className="flex items-center gap-2">
                  Verify & continue
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#7a7c7c] hover:text-[#2d2f2f] transition-colors flex items-center gap-1.5"
                  onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change email
                </button>
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#2d2f2f] hover:underline disabled:opacity-50 disabled:no-underline"
                  onClick={() => sendCode(savedEmail)}
                  disabled={requestOtpMutation.isPending}
                >
                  {requestOtpMutation.isPending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Account details */}
          {step === 3 && (
            <Form {...accountForm}>
              <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
                <div className="bg-white rounded-xl border border-[#e5e5e0] px-3.5 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="w-7 h-7 rounded-md bg-[#2d2f2f] flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#ecfe8d]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#7a7c7c]">Verified</p>
                    <p className="text-[13px] font-semibold text-[#2d2f2f] truncate">{savedEmail}</p>
                  </div>
                </div>

                <FormField
                  control={accountForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Full name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0a8]" />
                          <Input
                            className="h-12 pl-10 pr-4 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-[#2d2f2f]/10 focus-visible:border-[#2d2f2f]/30 transition-all placeholder:text-[#b0b0a8]"
                            placeholder="Your name"
                            {...field}
                            data-testid="input-signup-name"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={accountForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0a8]" />
                          <Input
                            className="h-12 pl-10 pr-12 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-[#2d2f2f]/10 focus-visible:border-[#2d2f2f]/30 transition-all placeholder:text-[#b0b0a8]"
                            placeholder="Min. 6 characters"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            {...field}
                            data-testid="input-signup-password"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0b0a8] hover:text-[#2d2f2f] transition-colors"
                            onClick={() => setShowPassword((v) => !v)}
                          >
                            {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={accountForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger
                            className="h-12 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-[#2d2f2f]/10"
                            data-testid="select-signup-role"
                          >
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-[#e5e5e0] shadow-lg">
                          <SelectItem value="ADMIN" className="rounded-lg cursor-pointer font-medium">Administrator</SelectItem>
                          <SelectItem value="CASHIER" className="rounded-lg cursor-pointer font-medium">Cashier</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12 rounded-xl border-[#e5e5e0] text-[#7a7c7c] hover:bg-white hover:text-[#2d2f2f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] shrink-0"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 rounded-xl text-[15px] font-bold bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white transition-all active:scale-[0.98] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.08)]"
                    disabled={signupMutation.isPending}
                    data-testid="button-signup-submit"
                  >
                    {signupMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating account…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Create account
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-[#e5e5e0]" />
            <span className="text-[11px] font-semibold text-[#b0b0a8] uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[#e5e5e0]" />
          </div>

          <Link href="/login">
            <Button
              variant="outline"
              className="w-full mt-5 h-12 rounded-xl text-[15px] font-semibold border-[#e5e5e0] bg-white text-[#2d2f2f] hover:bg-[#f5f5f0] hover:border-[#d0d0c8] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              data-testid="link-to-login"
            >
              Sign in instead
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
