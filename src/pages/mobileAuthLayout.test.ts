import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('mobile authentication layout', () => {
  it('uses one focused phone viewport and hides desktop marketing below md', () => {
    const login = source('./Login.tsx');
    expect(login).toContain('min-h-[100dvh]');
    expect(login).toContain('hidden border-r border-border');
    expect(login).toContain('max-w-sm');
    expect(login).toContain('role="tablist"');
    expect(login).toContain("mode === 'login'");
  });

  it('keeps accessible credential metadata and existing password validation parity', () => {
    const loginForm = source('../components/auth/LoginForm.tsx');
    const signUpForm = source('../components/auth/SignUpForm.tsx');
    expect(loginForm).toContain('autoComplete="current-password"');
    expect(loginForm).toContain("role=\"alert\"");
    expect(loginForm).toContain("aria-label={showPassword ? 'Hide password' : 'Show password'}");
    expect(signUpForm).toContain('autoComplete="new-password"');
    expect(signUpForm).toContain('password.length < 6');
    expect(signUpForm).toContain('minLength={6}');
  });
});
