/** Who is calling: the Clerk session behind a request's `Authorization: Bearer` token or `__session` cookie. */
import type { IncomingMessage } from 'node:http';
import { createClerkClient } from '@clerk/backend';

export interface Viewer {
  userId: string;
  /** Whether the user's plan includes a billing feature (from the session token, no extra request). */
  hasFeature(slug: string): boolean;
}

export type Authenticate = (req: IncomingMessage) => Promise<Viewer | null>;

export interface ClerkOptions {
  secretKey: string;
  publishableKey: string;
  /** The site's own origins (https://app.example.com): tokens minted for any other site are refused. */
  authorizedParties?: string[];
  /** The instance's PEM public key (Clerk → API keys → JWT public key): verifies tokens without calling Clerk. */
  jwtKey?: string;
}

/** A Node request as a Fetch Request, for Clerk; the body only when given (webhooks). */
export function toFetchRequest(req: IncomingMessage, body?: Uint8Array<ArrayBuffer>): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) headers.append(name, v);
  }
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  return new Request(`${proto}://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { method: req.method, headers, body });
}

export function clerkAuth({ secretKey, publishableKey, authorizedParties, jwtKey }: ClerkOptions): Authenticate {
  const clerk = createClerkClient({ secretKey, publishableKey, jwtKey });
  return async (req) => {
    try {
      const state = await clerk.authenticateRequest(toFetchRequest(req), { authorizedParties, jwtKey, acceptsToken: 'session_token' });
      if (!state.isAuthenticated) return null;
      const auth = state.toAuth();
      return { userId: auth.userId, hasFeature: (slug) => auth.has({ feature: slug }) };
    } catch (err) {
      console.error('Clerk:', err instanceof Error ? err.message : err);
      return null;
    }
  };
}
