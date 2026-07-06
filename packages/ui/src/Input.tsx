import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded border border-line bg-paper px-2.5 py-2 text-sm text-ink',
        'placeholder:text-ink-3',
        'focus:outline-none focus:ring-2 focus:ring-[#99b3d6] focus:ring-offset-[-1px]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';