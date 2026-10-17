/**
 * Lets the app talk to the Claude API without the key ever reaching the browser: requests
 * to /api/anthropic/v1/messages are forwarded to api.anthropic.com with ANTHROPIC_API_KEY
 * added here, and the streamed reply is piped back. Used by `npm run dev`, `npm run preview`
 * and the production server (server/main.ts), where a gate lets only signed-in learners
 * through, within their plan's daily allowance.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

const UPSTREAM = 'https://api.anthropic.com';
export const PROXY_PREFIX = '/api/anthropic';
const REQUEST_HEADERS = ['anthropic-version', 'anthropic-beta', 'content-type', 'accept'];
const RESPONSE_HEADERS = ['content-type', 'request-id', 'retry-after', 'x-should-retry'];
const MAX_BODY = 8 * 1024 * 1024;

export function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export const apiError = (type: string, message: string) => ({ type: 'error', error: { type, message } });

export function readBody(req: IncomingMessage, max = MAX_BODY): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    // Too large: stop keeping it, but let it arrive so the client reads the 413 instead of a dropped connection.
    if (Number(req.headers['content-length']) > max) {
      req.resume();
      return reject(new Error('body too large'));
    }
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Browsers send Origin on cross-site requests; when present it must be this host ("null" never is). */
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/** The Host header's name without the port; `[::1]` keeps its brackets. */
export function hostName(host: string | undefined): string {
  if (!host) return '';
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
}

/** A refusal sent back in the API's own error shape; the SDK does not retry it. */
export interface Refusal {
  status: number;
  type: string;
  message: string;
}

/** Decides who may use the server's key (the production server's sign-in and daily allowance). */
export interface Gate {
  /** Extra fields for /status, or a refusal (not signed in). */
  status(req: IncomingMessage): Promise<Record<string, unknown> | Refusal>;
  /** Runs before a request is forwarded, with its parsed body; returns a refusal to stop it. */
  admit(req: IncomingMessage, body: Record<string, unknown>): Promise<Refusal | undefined>;
}

export interface ProxyOptions {
  /**
   * Checked against the Host header: a page on another site that rebinds its own domain name
   * to this server's address still sends its own name as the Host. (Vite's dev and preview
   * servers already check the host before any middleware runs.)
   */
  allowedHosts?: string[];
  gate?: Gate;
}

export const isRefusal = (x: unknown): x is Refusal => Boolean(x) && typeof (x as Refusal).status === 'number' && typeof (x as Refusal).type === 'string';

export function refuse(res: ServerResponse, r: Refusal) {
  res.setHeader('x-should-retry', 'false');
  json(res, r.status, apiError(r.type, r.message));
}

export function anthropicProxy(apiKey: string | undefined, { allowedHosts, gate }: ProxyOptions = {}): Middleware {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith(`${PROXY_PREFIX}/`)) return next();
    if (allowedHosts && !allowedHosts.includes(hostName(req.headers.host).toLowerCase())) {
      return json(res, 403, apiError('permission_error', 'Host não permitido.'));
    }
    void handle(req, res, url.slice(PROXY_PREFIX.length), apiKey, gate).catch((err) => {
      console.error('Tutor proxy:', err);
      if (!res.headersSent) json(res, 500, apiError('api_error', 'Erro interno do servidor.'));
      else res.end();
    });
  };
}

async function handle(req: IncomingMessage, res: ServerResponse, path: string, apiKey: string | undefined, gate: Gate | undefined) {
  if (path === '/status') {
    const extra = gate ? await gate.status(req) : {};
    if (isRefusal(extra)) return refuse(res, extra);
    return json(res, 200, { available: Boolean(apiKey), ...extra });
  }
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
  if (gate) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      return json(res, 400, apiError('invalid_request_error', 'JSON inválido.'));
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json(res, 400, apiError('invalid_request_error', 'Envie um objeto JSON.'));
    const refusal = await gate.admit(req, parsed as Record<string, unknown>);
    if (refusal) return refuse(res, refusal);
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
