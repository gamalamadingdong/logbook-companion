import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { expect, it, vi } from 'vitest';

async function handlerFor(name: string, rpc: ReturnType<typeof vi.fn>) {
  const source = readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8')
    .replace(/import \{ createClient \} from '[^']+';/, '');
  let handler!: (request: Request) => Promise<Response>;
  const from = vi.fn();
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'caller' } }, error: null }) }, rpc, from };
  const script = transpileModule(source, { compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { Deno: { env: { get: () => 'test-config' }, serve: (fn: typeof handler) => { handler = fn; } }, createClient: () => supabase, Response, Request, console });
  return { handler, from };
}
for (const name of ['invite-coaches', 'send-team-invite']) {
  it(`${name} denies staff invitations without team administration before any privileged lookup`, async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const { handler, from } = await handlerFor(name, rpc);
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: 'team', entries: [{ email: 'coach@example.com' }], recipientEmail: 'athlete@example.com' }) }));
    expect(response.status).toBe(403);
    expect(rpc).toHaveBeenCalledWith('can_admin_team', { p_team_id: 'team', p_user_id: 'caller' });
    expect(from).not.toHaveBeenCalled();
  });
  it(`${name} fails closed when the administration check fails`, async () => {
    const { handler, from } = await handlerFor(name, vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } }));
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ teamId: 'team', entries: [{ email: 'coach@example.com' }], recipientEmail: 'athlete@example.com' }) }));
    expect(response.status).toBe(500); expect(from).not.toHaveBeenCalled();
  });
}
