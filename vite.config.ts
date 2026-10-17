/// <reference types="vitest/config" />
import { type Plugin, defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Middleware } from './server/anthropic-proxy.ts';
import { apiFromEnv } from './server/config.ts';

/**
 * The server's API (accounts, saved progress, the tutor's Claude API proxy) on the dev and
 * preview servers; keys come from the environment or .env.local. Vite checks the host itself.
 */
function serverApi(env: Record<string, string>): Plugin {
  let api: Promise<Middleware> | undefined;
  const middleware: Middleware = (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    api ??= apiFromEnv(env, { checkHosts: false }).then((a) => a.api);
    api.then((m) => m(req, res, next), next);
  };
  return {
    name: 'chemrster-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), serverApi(env)],
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  };
});
