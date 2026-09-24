import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  trailingAction?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, trailingAction, className = '', ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-content-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={`
              min-h-11 w-full px-3 py-2 text-sm rounded-lg
              bg-surface-secondary border border-border text-content-primary
              placeholder-content-faint
              focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent-primary
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              ${trailingAction ? 'pr-12' : ''}
              ${error ? 'border-red-500 focus:ring-red-500/40' : ''}
              ${className}
            `}
            {...props}
          />
          {trailingAction && <div className="absolute inset-y-0 right-0 flex items-center">{trailingAction}</div>}
        </div>
        {hint && !error && <p className="text-[11px] text-content-faint">{hint}</p>}
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = '', children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-content-muted">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-3 py-1.5 text-sm rounded-lg
            bg-surface-secondary border border-border text-content-primary
            focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent-primary
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500/40' : ''}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
