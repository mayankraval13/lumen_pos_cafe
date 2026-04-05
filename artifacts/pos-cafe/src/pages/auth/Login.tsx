import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
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
import { Coffee, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: FormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          login(response.token, response.user);
          toast.success('Welcome back!');
          if (response.user.role === 'WAITER') {
            setLocation('/waiter');
          } else {
            setLocation('/backend/pos-config');
          }
        },
        onError: (error: any) => {
          toast.error(error.message || 'Invalid email or password');
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
            Your restaurant,<br />running smarter.
          </p>
          <p className="text-white/60 text-sm mt-2 drop-shadow-sm">
            Orders &middot; Tables &middot; Kitchen &middot; Payments
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 min-h-screen">
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

          <div className="mb-8">
            <h2 className="text-[28px] font-extrabold text-[#2d2f2f] tracking-tight leading-tight">Welcome back</h2>
            <p className="text-[#7a7c7c] mt-1.5 text-[15px]">
              Sign in to your account to continue
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Email</FormLabel>
                    <FormControl>
                      <Input
                        className="h-12 px-4 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-[#2d2f2f]/10 focus-visible:border-[#2d2f2f]/30 transition-all placeholder:text-[#b0b0a8]"
                        placeholder="you@example.com"
                        type="email"
                        autoComplete="email"
                        {...field}
                        data-testid="input-login-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#2d2f2f] font-semibold text-[13px]">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="h-12 px-4 pr-12 rounded-xl bg-white border-[#e5e5e0] text-[#2d2f2f] text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-[#2d2f2f]/10 focus-visible:border-[#2d2f2f]/30 transition-all placeholder:text-[#b0b0a8]"
                          placeholder="Enter password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          {...field}
                          data-testid="input-login-password"
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

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-[15px] font-bold bg-[#2d2f2f] hover:bg-[#3a3c3c] text-white transition-all active:scale-[0.98] shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.08)] mt-2"
                disabled={loginMutation.isPending}
                data-testid="button-login-submit"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-[#e5e5e0]" />
            <span className="text-[11px] font-semibold text-[#b0b0a8] uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[#e5e5e0]" />
          </div>

          <Link href="/signup">
            <Button
              variant="outline"
              className="w-full mt-5 h-12 rounded-xl text-[15px] font-semibold border-[#e5e5e0] bg-white text-[#2d2f2f] hover:bg-[#f5f5f0] hover:border-[#d0d0c8] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              data-testid="link-to-signup"
            >
              Create a new account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
