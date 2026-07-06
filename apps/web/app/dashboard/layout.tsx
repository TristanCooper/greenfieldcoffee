import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell, PageHeader, type NavItem } from '@greenfield/ui';
import { getCurrentUser } from '@/lib/auth';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Daily board' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/stock', label: 'Stock' },
  { href: '/dashboard/receive-green', label: 'Receive green' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/compliance', label: 'Compliance' },
  { href: '/dashboard/reports', label: 'Reports' },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Greenfield Coffee';
  const userName = (user.user_metadata as { full_name?: string } | undefined)?.full_name
    ?? user.email
    ?? undefined;

  return (
    <AppShell appName={appName} userName={userName} nav={NAV}>
      {children}
    </AppShell>
  );
}

/**
 * `PageHeader` is re-exported so individual pages can import from a single path.
 * Not strictly needed but keeps imports tidy.
 */
export { PageHeader };