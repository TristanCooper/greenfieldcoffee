'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardTitle, Input } from '@greenfield/ui';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(next as '/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-[420px]">
      <CardTitle>Sign in to Greenfield Coffee</CardTitle>
      <p className="mb-4 mt-0 text-sm text-ink-3">
        Welcome back. Enter your details to continue.
      </p>
      {error && (
        <div className="mb-3 rounded bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-2">
        New here?{' '}
        <Link href="/signup" className="text-accent underline">
          Create your roastery
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Suspense fallback={<div className="text-sm text-ink-3">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}