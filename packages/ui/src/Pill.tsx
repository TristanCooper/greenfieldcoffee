import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const toneClass: Record<Tone, string> = {
  ok:      'bg-ok-soft text-ok',
  warn:    'bg-warn-soft text-warn',
  bad:     'bg-bad-soft text-bad',
  info:    'bg-info-soft text-accent',
  neutral: 'bg-[#ececea] text-ink-2',
};

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide', toneClass[tone], className)}>
      {children}
    </span>
  );
}