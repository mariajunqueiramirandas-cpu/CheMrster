/// <reference types="vitest/config" />
import { type Plugin, defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { anthropicProxy } from './server/anthropic-proxy.ts';

/** The tutor's Claude API proxy on the dev and preview servers; the key comes from the environment or .env.local. */
function tutorProxy(apiKey: string | undefined): Plugin {
  const middleware = anthropicProxy(apiKey);
  return {
    name: 'chemrster-tutor-proxy',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tutorProxy(env.ANTHROPIC_API_KEY)],
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  };
});
