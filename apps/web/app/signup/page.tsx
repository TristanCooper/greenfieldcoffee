'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardTitle, Input, Select } from '@greenfield/ui';
import { createClient } from '@/lib/supabase/client';

type Currency = 'GBP' | 'EUR';

export default function SignupPage() {
  const router = useRouter();

  const [roasteryName, setRoasteryName] = useState('');
  const [countryCode, setCountryCode] = useState('GB');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roasteryName,
          countryCode,
          currency,
          fullName,
          email,
          password,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Signup failed.');
        setPending(false);
        return;
      }
      // The signup endpoint also signed the user in via Supabase Auth.
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-[480px]">
        <CardTitle>Create your roastery</CardTitle>
        <p className="mb-4 mt-0 text-sm text-ink-3">
          You&rsquo;ll be the owner. You can invite roasters and sales staff
          after signing in.
        </p>
        {error && (
          <div className="mb-3 rounded bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="roasteryName" className="mb-1 block text-xs text-ink-2">
              Roastery name
            </label>
            <Input
              id="roasteryName"
              required
              value={roasteryName}
              onChange={(e) => setRoasteryName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="countryCode" className="mb-1 block text-xs text-ink-2">
                Country
              </label>
              <Select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                <option value="GB">United Kingdom</option>
                <option value="IE">Ireland</option>
                <option value="FR">France</option>
                <option value="DE">Germany</option>
                <option value="NL">Netherlands</option>
                <option value="BE">Belgium</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="DK">Denmark</option>
                <option value="SE">Sweden</option>
              </Select>
            </div>
            <div>
              <label htmlFor="currency" className="mb-1 block text-xs text-ink-2">
                Default currency
              </label>
              <Select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="fullName" className="mb-1 block text-xs text-ink-2">
              Your name
            </label>
            <Input
              id="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-ink-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs text-ink-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create roastery'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          Already have an account?{' '}
          <Link href="/login" className="text-accent underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}