import type { ReactNode } from 'react';
import { cn } from './cn';

export interface Step {
  label: string;
  description?: string;
}

export function StepIndicator({
  steps,
  currentIndex,
  className,
}: {
  steps: readonly Step[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex w-full items-start gap-2', className)}>
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const tone = isDone
          ? 'bg-accent text-paper border-accent'
          : isCurrent
            ? 'bg-paper text-accent border-accent'
            : 'bg-paper text-ink-3 border-line';
        return (
          <li key={step.label} className="flex flex-1 flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                  tone,
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? '\u2713' : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-ink' : 'text-ink-2',
                )}
              >
                {step.label}
              </span>
            </div>
            {step.description && (
              <p className="pl-8 text-xs text-ink-3">{step.description}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StepBody({ children }: { children: ReactNode }) {
  return <div className="mt-6">{children}</div>;
}