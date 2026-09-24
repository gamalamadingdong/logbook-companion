import React, { useState } from 'react';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../ui';

interface SignUpFormProps {
  onSwitchToLogin: () => void;
}

export function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      setSuccess(true);
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : 'Account creation could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary-surface text-accent-primary"><CheckCircle size={28} /></div>
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Check your email</h1>
          <p className="mt-1 text-sm text-content-secondary">We sent a verification link to <strong className="text-content-primary">{email}</strong>.</p>
        </div>
        <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={onSwitchToLogin}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-content-primary">Create your account</h1>
        <p className="mt-1 text-sm text-content-secondary">Start your Logbook Companion</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-accent-danger bg-surface-secondary px-3 py-2 text-sm text-accent-danger-text">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input id="signup-name" name="name" label="Name" type="text" autoComplete="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
        <Input id="signup-email" name="email" label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Input
          id="signup-password"
          name="new-password"
          label="Password"
          hint="At least 6 characters"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a password"
          trailingAction={(
            <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11 px-0" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </Button>
          )}
        />
        <Input id="signup-confirm-password" name="confirm-password" label="Confirm password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" />
        <Button type="submit" loading={loading} className="min-h-11 w-full">{loading ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </div>
  );
}
