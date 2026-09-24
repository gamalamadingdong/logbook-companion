import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../ui';

interface LoginFormProps {
  onForgotPassword: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-content-primary">Welcome back</h1>
        <p className="mt-1 text-sm text-content-secondary">Sign in to your Logbook account</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-accent-danger bg-surface-secondary px-3 py-2 text-sm text-accent-danger-text">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          id="login-email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <Input
          id="login-password"
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          trailingAction={(
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11 px-0"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </Button>
          )}
        />
        <Button type="submit" loading={loading} className="min-h-11 w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <Button type="button" variant="ghost" size="sm" className="min-h-11 w-full" onClick={onForgotPassword}>
        Forgot your password?
      </Button>
    </div>
  );
}
