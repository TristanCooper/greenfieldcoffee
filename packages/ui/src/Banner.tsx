import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'info' | 'warn' | 'bad' | 'ok';

const toneClass: Record<Tone, string> = {
  info: 'bg-[#e8edf5] border border-[#c4cee0] text-accent',
  warn: 'bg-warn-soft border border-[#d6c181] text-warn',
  bad:  'bg-bad-soft border border-[#e0b0b0] text-bad',
  ok:   'bg-ok-soft border border-[#b0d3b6] text-ok',
};

export function Banner({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 rounded px-3 py-2.5 text-[13px]', toneClass[tone], className)}>
      {children}
    </div>
  );
}