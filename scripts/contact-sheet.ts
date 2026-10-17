/**
 * Renders every gallery molecule into one HTML contact sheet and screenshots it with
 * headless Chromium, for eyeballing typography and geometry.
 *
 *   npm run sheet -- [out-dir] [style] [id,id,...]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOLECULES } from '../src/content/molecules.ts';
import { renderSVG } from '../src/nanquim/index.ts';
import type { StyleName } from '../src/nanquim/style.ts';

const outDir = resolve(process.argv[2] ?? 'out');
const style = (process.argv[3] ?? 'textbook') as StyleName;
const only = process.argv[4]?.split(',');
mkdirSync(outDir, { recursive: true });

const cells: string[] = [];
let failures = 0;
for (const m of MOLECULES) {
  if (only && !only.includes(m.id)) continue;
  let svg: string;
  try {
    svg = renderSVG(m.smiles, { style, title: m.name });
  } catch (err) {
    failures++;
    svg = `<pre style="color:#b00">${String(err)}</pre>`;
  }
  cells.push(`<figure>${svg}<figcaption>${m.name}</figcaption></figure>`);
}

const PAGE = 16;
const pages = Math.ceil(cells.length / PAGE);
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium';
for (let page = 0; page < pages; page++) {
  const slice = cells.slice(page * PAGE, (page + 1) * PAGE);
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#fbfaf6;color:#1b1b1f;font:13px system-ui;}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
figure{margin:0;background:#fff;border:1px solid #e6e2d8;border-radius:10px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:220px;box-sizing:border-box}
figure svg{max-height:180px;width:auto}
figure svg{max-width:100%;height:auto}
figcaption{margin-top:8px;color:#6b665c}
</style><main>${slice.join('\n')}</main>`;
  const htmlPath = resolve(outDir, `sheet-${style}-${page + 1}.html`);
  writeFileSync(htmlPath, html);
  const png = resolve(outDir, `sheet-${style}-${page + 1}.png`);
  execFileSync(
    chrome,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1.5',
      '--window-size=1200,1100',
      `--screenshot=${png}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );
}
console.log(`${cells.length} molecules in ${pages} pages, ${failures} failures → ${outDir}`);
