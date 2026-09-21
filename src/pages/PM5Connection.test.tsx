import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PM5Connection } from './PM5Connection';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '11111111-2222-4333-8444-555555555555' } }),
}));

describe('PM5Connection', () => {
  it('renders the direct athlete connect and program flow', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PM5Connection /></MemoryRouter>);
    expect(html).toContain('Connect PM5');
    expect(html).toContain('Program workout');
    expect(html).toContain('Find PM5');
  });
});
