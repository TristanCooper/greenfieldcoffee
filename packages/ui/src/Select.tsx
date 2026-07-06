import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded border border-line bg-paper px-2.5 py-2 text-sm text-ink',
        'focus:outline-none focus:ring-2 focus:ring-[#99b3d6] focus:ring-offset-[-1px]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';