import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anthropicProxy } from './anthropic-proxy.ts';

const realFetch = globalThis.fetch;

async function serve(apiKey: string | undefined) {
  const proxy = anthropicProxy(apiKey);
  const server = createServer((req, res) => proxy(req, res, () => ((res.statusCode = 404), res.end('next'))));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

afterEach(() => vi.unstubAllGlobals());

describe('anthropic proxy', () => {
  it('reports whether a key is configured', async () => {
    for (const key of ['sk-test', undefined]) {
      const s = await serve(key);
      const res = await realFetch(`${s.base}/api/anthropic/status`);
      expect(await res.json()).toEqual({ available: Boolean(key) });
      await s.close();
    }
  });

  it('forwards the Messages API with the server key and streams the reply back', async () => {
    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('event: ping\ndata: {}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_1' } }));
    vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith('https://api.anthropic.com') ? upstream(String(url), init!) : realFetch(url, init),
    );
    const s = await serve('sk-secret');
    const res = await realFetch(`${s.base}/api/anthropic/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'from-browser', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'x' },
      body: JSON.stringify({ model: 'claude-opus-5-5' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('request-id')).toBe('req_1');
    expect(await res.text()).toContain('event: ping');
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('sk-secret');
    expect(headers.get('anthropic-beta')).toBe('x');
    expect(JSON.parse(new TextDecoder().decode(init.body as Uint8Array))).toEqual({ model: 'claude-opus-5-5' });
    await s.close();
  });

  it('refuses anything but the Messages API, other origins and missing keys', async () => {
    const s = await serve('sk-secret');
    const post = (path: string, headers: Record<string, string> = {}) =>
      realFetch(`${s.base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
    expect((await post('/api/anthropic/v1/files')).status).toBe(404);
    expect((await post('/api/anthropic/v1/messages', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/api/anthropic/v1/messages', { origin: 'null' })).status).toBe(403);
    expect((await realFetch(`${s.base}/other`)).status).toBe(404);
    await s.close();
    const none = await serve(undefined);
    expect((await realFetch(`${none.base}/api/anthropic/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(503);
    await none.close();
  });
});
