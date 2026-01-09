import React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * KAA Design System - Button Component
 * A reusable button component with multiple variants and sizes
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const classNames = [
    'kaa-btn',
    `kaa-btn--${variant}`,
    `kaa-btn--${size}`,
    fullWidth ? 'kaa-btn--full-width' : '',
    loading ? 'kaa-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="kaa-btn__spinner" aria-hidden="true">
          <svg
            className="kaa-btn__spinner-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
            />
          </svg>
        </span>
      )}
      {!loading && leftIcon && (
        <span className="kaa-btn__icon kaa-btn__icon--left">{leftIcon}</span>
      )}
      <span className="kaa-btn__content">{children}</span>
      {!loading && rightIcon && (
        <span className="kaa-btn__icon kaa-btn__icon--right">{rightIcon}</span>
      )}
    </button>
  );
};

export default Button;

// Also export as named export for flexibility
export { Button };
