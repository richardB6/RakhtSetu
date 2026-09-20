'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Droplets, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/command-center';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.push(callbackUrl);
    } else {
      setError(result.message || 'Login failed');
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: 'Hospital', email: 'hospital@demo.rakthsetu.in', password: 'Demo@Hospital1' },
    { label: 'Blood Bank', email: 'bloodbank@demo.rakthsetu.in', password: 'Demo@BloodBank1' },
    { label: 'Donor', email: 'donor@demo.rakthsetu.in', password: 'Demo@Donor1' },
    { label: 'Admin', email: 'admin@demo.rakthsetu.in', password: 'Demo@Admin1' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <Droplets className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">RAKTHSETU</h1>
          <p className="text-sm text-muted-foreground">
            Emergency Blood Coordination Network
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
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
                  className="h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Accounts */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Demo Accounts
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.label}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="text-left px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
              >
                <p className="text-xs font-medium text-foreground">
                  {account.label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {account.email}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
