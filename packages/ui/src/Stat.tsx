import type { ReactNode } from 'react';

export function Stat({ value, unit, label }: { value: ReactNode; unit?: ReactNode; label?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[22px] font-semibold text-ink">{value}</span>
      {unit && <span className="text-xs text-ink-3">{unit}</span>}
      {label && <span className="text-xs text-ink-3">{label}</span>}
    </div>
  );
}