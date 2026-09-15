import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('admin email notification ownership', () => {
  it('keeps signup and feedback notification delivery out of browser code', () => {
    const authContextSource = readFileSync(
      new URL('../auth/AuthContext.tsx', import.meta.url),
      'utf8',
    );
    const feedbackModalSource = readFileSync(
      new URL('../components/FeedbackModal.tsx', import.meta.url),
      'utf8',
    );

    expect(authContextSource).not.toContain('notify-user-signup');
    expect(feedbackModalSource).not.toContain('notify-feedback');
  });
});