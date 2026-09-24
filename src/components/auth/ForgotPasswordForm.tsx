import React, { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../ui';

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Password reset could not be started.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary-surface text-accent-primary"><Mail size={28} /></div>
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Check your email</h1>
          <p className="mt-1 text-sm text-content-secondary">We sent password reset instructions to <strong className="text-content-primary">{email}</strong>.</p>
        </div>
        <Button type="button" variant="secondary" className="min-h-11 w-full" icon={<ArrowLeft size={16} />} onClick={onSwitchToLogin}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-content-primary">Reset password</h1>
        <p className="mt-1 text-sm text-content-secondary">Enter your email and we’ll send a reset link.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-accent-danger bg-surface-secondary px-3 py-2 text-sm text-accent-danger-text">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input id="reset-email" name="email" label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Button type="submit" loading={loading} className="min-h-11 w-full">{loading ? 'Sending reset link…' : 'Send reset link'}</Button>
      </form>
      <Button type="button" variant="ghost" className="min-h-11 w-full" icon={<ArrowLeft size={16} />} onClick={onSwitchToLogin}>Back to sign in</Button>
    </div>
  );
}
