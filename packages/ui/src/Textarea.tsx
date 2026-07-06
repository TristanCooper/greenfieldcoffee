import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
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
Textarea.displayName = 'Textarea';