import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'ghost'
    | 'link'
    | 'info'
    | 'success'
    | 'warning'
    | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  outline?: boolean;
  loading?: boolean;
  wide?: boolean;
  glass?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  outline = false,
  loading = false,
  wide = false,
  glass = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'btn';

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    link: 'btn-link',
    info: 'btn-info',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error',
  };

  const sizeClasses = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    outline && 'btn-outline',
    loading && 'loading',
    wide && 'btn-wide',
    glass && 'glass',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading loading-spinner"></span>}
      {children}
    </button>
  );
};

export default Button;
