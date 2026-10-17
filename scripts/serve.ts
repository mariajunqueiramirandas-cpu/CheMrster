/**
 * Serves the production build with the tutor's Claude API proxy, for running the app on
 * your own machine or server:
 *
 *   npm run build && ANTHROPIC_API_KEY=sk-ant-... npm run serve -- [port]
 *
 * Anyone who can open the page can use the key through the proxy, so put it behind your
 * own login before exposing it to the internet.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { anthropicProxy } from '../server/anthropic-proxy.ts';

const root = resolve('dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('Rode "npm run build" antes de "npm run serve".');
  process.exit(1);
}

const proxy = anthropicProxy(process.env.ANTHROPIC_API_KEY);

createServer((req, res) =>
  proxy(req, res, () => {
    let path: string;
    try {
      path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    } catch {
      res.statusCode = 400;
      return res.end();
    }
    let file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    if (file.includes(`${join(root, 'assets')}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    createReadStream(file).pipe(res);
  }),
).listen(port, () => {
  const tutor = process.env.ANTHROPIC_API_KEY ? 'tutor com IA ligado' : 'sem ANTHROPIC_API_KEY: o tutor usa a própria chave do aluno ou o modo offline';
  console.log(`CheMrster em http://localhost:${port} (${tutor})`);
});
