import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const variantClass: Record<Variant, string> = {
  primary:   'bg-accent text-paper border border-accent hover:bg-[#1f2c42]',
  secondary: 'bg-paper text-accent border border-accent hover:bg-bg-subtle',
  ghost:     'bg-transparent text-ink-2 border border-line hover:bg-bg-subtle',
  danger:    'bg-bad text-paper border border-bad hover:bg-[#7d2222]',
};

const sizeClass: Record<Size, string> = {
  md: 'px-3.5 py-2 text-sm',
  sm: 'px-2.5 py-1 text-xs',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';