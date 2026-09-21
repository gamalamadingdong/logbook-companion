import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PM5Connection } from './PM5Connection';

describe('PM5Connection', () => {
  it('renders the direct athlete connect and program flow', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PM5Connection /></MemoryRouter>);
    expect(html).toContain('Connect PM5');
    expect(html).toContain('Program workout');
    expect(html).toContain('Find PM5');
  });
});
