import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useSignup } from '@workspace/api-client-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Coffee } from 'lucide-react';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'CASHIER']),
});

type FormValues = z.infer<typeof formSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const signupMutation = useSignup();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ADMIN',
    },
  });

  const onSubmit = (data: FormValues) => {
    signupMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          login(response.token, response.user);
          toast.success('Account created successfully');
          setLocation('/backend/reporting');
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to create account');
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#d2d2d2] px-4 py-8 font-sans tracking-tight">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-[#2d2f2f] rounded-2xl flex items-center justify-center shadow-lg">
            <Coffee className="w-8 h-8 text-[#ecfe8d]" />
          </div>
        </div>
        <Card className="bg-white border-none rounded-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.10),_0_1px_4px_rgba(0,0,0,0.08)]">
          <CardHeader className="space-y-1 text-center pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight text-[#2d2f2f]">Create an account</CardTitle>
            <CardDescription className="text-[#5a5c5c] font-medium">Enter your details to get started with Lumen POS</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#5a5c5c] font-medium">Full Name</FormLabel>
                      <FormControl>
                        <Input className="border-gray-200 focus-visible:ring-[#ecfe8d] rounded-xl bg-gray-50 text-[#2d2f2f] h-12 px-4" placeholder="John Doe" {...field} data-testid="input-signup-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#5a5c5c] font-medium">Email</FormLabel>
                      <FormControl>
                        <Input className="border-gray-200 focus-visible:ring-[#ecfe8d] rounded-xl bg-gray-50 text-[#2d2f2f] h-12 px-4" placeholder="admin@cafe.com" type="email" {...field} data-testid="input-signup-email" />
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
                      <FormLabel className="text-[#5a5c5c] font-medium">Password</FormLabel>
                      <FormControl>
                        <Input className="border-gray-200 focus-visible:ring-[#ecfe8d] rounded-xl bg-gray-50 text-[#2d2f2f] h-12 px-4" placeholder="••••••••" type="password" {...field} data-testid="input-signup-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#5a5c5c] font-medium">Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-gray-200 focus-visible:ring-[#ecfe8d] rounded-xl bg-gray-50 text-[#2d2f2f] h-12 px-4" data-testid="select-signup-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                          <SelectItem value="ADMIN" className="rounded-lg cursor-pointer">Administrator</SelectItem>
                          <SelectItem value="CASHIER" className="rounded-lg cursor-pointer">Cashier</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full mt-6 h-14 rounded-xl text-white font-semibold transition-transform active:scale-[0.98] border-0 bg-gradient-to-b from-[#3a3c3c] to-[#2d2f2f]"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)' }}
                  size="lg"
                  disabled={signupMutation.isPending}
                  data-testid="button-signup-submit"
                >
                  {signupMutation.isPending ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm font-medium">
              <span className="text-[#5a5c5c]">Already have an account? </span>
              <Link href="/login">
                <span className="text-[#2d2f2f] font-semibold hover:underline cursor-pointer" data-testid="link-to-login">
                  Sign in
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
