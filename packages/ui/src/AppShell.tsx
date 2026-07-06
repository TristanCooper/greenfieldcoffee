import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  active?: boolean;
}

/**
 * Top app bar + main content slot.
 * Uses plain anchor tags rather than next/link so the package stays
 * framework-agnostic. apps/web can wrap navigation in its own Link
 * component if it wants client-side routing.
 */
export function AppShell({
  appName,
  userName,
  nav,
  children,
}: {
  appName: string;
  userName?: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center gap-6 rounded bg-accent px-4 py-2.5 text-[13px] text-paper">
        <div className="font-bold tracking-wide">{appName}</div>
        <nav className="flex flex-1 gap-4.5">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={
                item.active
                  ? 'font-semibold text-paper'
                  : 'text-accent-soft hover:text-paper hover:underline'
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
        {userName && <div className="text-xs text-accent-soft">{userName}</div>}
      </header>
      <main className="mx-auto max-w-[1180px] px-10 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, crumb }: { title: string; crumb?: string }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <h2 className="m-0 text-xl">{title}</h2>
      {crumb && <div className="text-xs text-ink-3">{crumb}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded border border-dashed border-line bg-bg-subtle p-8 text-center">
      <h3 className="m-0 mb-1.5 text-base text-ink">{title}</h3>
      {hint && <p className="m-0 text-sm text-ink-3">{hint}</p>}
    </div>
  );
}