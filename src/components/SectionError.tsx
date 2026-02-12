import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface SectionErrorProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * Inline error state for dashboard sections and cards.
 * Shows a message + optional retry button. Use `compact` for smaller cards.
 */
export const SectionError: React.FC<SectionErrorProps> = ({
  message = 'Unable to load this section.',
  onRetry,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-red-300/70 text-sm py-2">
        <AlertCircle size={14} className="text-red-500 shrink-0" />
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-red-400 hover:text-red-300 transition-colors ml-auto"
            title="Retry"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-red-900/10 border border-red-900/20 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle size={18} className="text-red-500 shrink-0" />
      <span className="text-sm text-red-200/70 flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
};
