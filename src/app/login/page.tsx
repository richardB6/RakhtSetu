'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const result = await login(email.trim().toLowerCase(), password);

    if (result.success) {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.success) {
          const role = meData.data?.user?.role;
          const verificationStatus = meData.data?.user?.verificationStatus;
          if (verificationStatus === 'PENDING') {
            setInfo('Your account is pending admin verification. You can view your dashboard but some features may be restricted.');
          }
          const destination = callbackUrl || (role === 'DONOR' ? '/donor' : '/command-center');
          router.push(destination);
        } else {
          router.push(callbackUrl || '/command-center');
        }
      } catch {
        router.push(callbackUrl || '/command-center');
      }
    } else {
      setError(result.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <Image
          src="/rakthsetu-logo.png"
          alt="RakthSetu"
          width={128}
          height={128}
          priority
          className="mx-auto mb-4 h-28 w-28 rounded-3xl object-cover shadow-[0_8px_24px_rgba(252,185,181,0.24)]"
          />
          <h1 className="text-2xl font-bold tracking-tight">RAKTHSETU</h1>
          <p className="text-sm text-muted-foreground">
            Emergency Blood Coordination Network
          </p>
        </div>

        {/* Login Form */}
        <div className="surface-card p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Sign In</h2>
            <p className="text-xs text-muted-foreground">
              Access the emergency coordination platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            {info && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-700">{info}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-9 text-sm font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Need an account?{' '}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-transparent" />}>
      <LoginForm />
    </Suspense>
  );
}
