/**
 * Lets the app talk to the Claude API without the key ever reaching the browser: requests
 * to /api/anthropic/v1/messages are forwarded to api.anthropic.com with ANTHROPIC_API_KEY
 * added here, and the streamed reply is piped back. Used by `npm run dev`, `npm run preview`
 * and `npm run serve`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

const UPSTREAM = 'https://api.anthropic.com';
export const PROXY_PREFIX = '/api/anthropic';
const REQUEST_HEADERS = ['anthropic-version', 'anthropic-beta', 'content-type', 'accept'];
const RESPONSE_HEADERS = ['content-type', 'request-id', 'retry-after', 'x-should-retry'];
const MAX_BODY = 8 * 1024 * 1024;

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

const apiError = (type: string, message: string) => ({ type: 'error', error: { type, message } });

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Browsers send Origin on cross-site requests; when present it must be this host ("null" never is). */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

export function anthropicProxy(apiKey: string | undefined): Middleware {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith(`${PROXY_PREFIX}/`)) return next();
    void handle(req, res, url.slice(PROXY_PREFIX.length), apiKey);
  };
}

async function handle(req: IncomingMessage, res: ServerResponse, path: string, apiKey: string | undefined) {
  if (path === '/status') return json(res, 200, { available: Boolean(apiKey) });
  if (!apiKey) return json(res, 503, apiError('proxy_not_configured', 'ANTHROPIC_API_KEY não está definida no servidor.'));
  // Only the Messages API, only from this site's own pages.
  if (req.method !== 'POST' || !/^\/v1\/messages(\?|$)/.test(path)) return json(res, 404, apiError('not_found_error', 'Rota não disponível.'));
  if (!sameOrigin(req)) return json(res, 403, apiError('permission_error', 'Origem não permitida.'));
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    return json(res, 415, apiError('invalid_request_error', 'Envie JSON.'));
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 413, apiError('request_too_large', 'Pedido grande demais.'));
  }
  const headers = new Headers({ 'x-api-key': apiKey });
  for (const name of REQUEST_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}${path}`, { method: 'POST', headers, body: new Uint8Array(body), signal: abort.signal });
  } catch (err) {
    if (abort.signal.aborted) return;
    return json(res, 502, apiError('api_error', `Não foi possível falar com a API: ${err instanceof Error ? err.message : String(err)}`));
  }
  res.statusCode = upstream.status;
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  if (!upstream.body) return res.end();
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch {
    // The browser went away mid-stream.
  }
  res.end();
}
