import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PM5Provider } from '../contexts/PM5Context';
import { PM5Connection } from './PM5Connection';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '11111111-2222-4333-8444-555555555555' } }),
}));

describe('PM5Connection', () => {
  it('renders preflight before any connection action', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PM5Provider>
          <PM5Connection />
        </PM5Provider>
      </MemoryRouter>,
    );
    expect(html).toContain('Train with PM5');
    expect(html).toContain('Workout preflight');
    expect(html).toContain('Review workout');
    expect(html).not.toContain('Find PM5');
  });
});
