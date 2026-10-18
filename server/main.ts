/**
 * The production server: serves ./dist and the API (accounts, saved progress, the tutor's
 * Claude API proxy). In the Docker image it runs as
 *
 *   node --experimental-strip-types server/main.ts
 *
 * and locally, after `npm run build`, as `npm run serve -- [port]`. Configuration comes from
 * the environment (see .env.example). Without the Clerk keys it runs as before accounts: no
 * sign-in, data on the device only, and the tutor proxy open to localhost names alone.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { apiFromEnv } from './config.ts';

const root = resolve(process.env.STATIC_DIR ?? 'dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('Rode "npm run build" antes de "npm run serve".');
  process.exit(1);
}

const { api, db, accounts } = await apiFromEnv(process.env);
const bind = process.env.HOST ?? '127.0.0.1';

const server = createServer((req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'DENY');
  api(req, res, () => {
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
    else res.setHeader('cache-control', 'no-cache');
    // A file that vanished (a rebuild in progress) or cannot be read is a 404, not a crash.
    createReadStream(file)
      .on('error', () => {
        if (!res.headersSent) res.statusCode = 404;
        res.end();
      })
      .pipe(res);
  });
}).listen(port, bind, () => {
  const tutor = process.env.ANTHROPIC_API_KEY ? 'tutor com IA ligado' : 'sem ANTHROPIC_API_KEY: o tutor usa a própria chave do aluno ou o modo offline';
  console.log(`CheMrster em http://${bind === '0.0.0.0' ? 'localhost' : bind}:${port} (${accounts ? 'contas Clerk ligadas' : 'sem contas'}; ${tutor})`);
});

// Docker stops containers with SIGTERM: finish open requests, then close the database.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => void db.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
