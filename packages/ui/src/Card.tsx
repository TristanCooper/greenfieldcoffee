import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded border border-line bg-paper p-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="m-0 mb-1.5 text-sm font-semibold text-ink">{children}</h3>;
}

export function CardMeta({ children }: { children: ReactNode }) {
  return <div className="text-xs text-ink-3">{children}</div>;
}