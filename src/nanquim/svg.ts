/** Serialise a Drawing as a standalone, print-ready SVG document. */
import type { Vec } from './geometry.ts';
import type { Drawing, Primitive } from './depict.ts';

const f = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pts = (points: Vec[]) => points.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');

export interface SvgOptions {
  /** Accessible name, e.g. the compound's name. */
  title?: string;
  /** Multiply the natural size (viewBox units are px at bondLength). */
  scale?: number;
  /** Extra attributes for the root element, e.g. class names. */
  className?: string;
  background?: string;
}

function primToSvg(p: Primitive): string {
  if (p.type === 'line') {
    return `<line x1="${f(p.a.x)}" y1="${f(p.a.y)}" x2="${f(p.b.x)}" y2="${f(p.b.y)}" stroke="${p.color}" stroke-width="${f(p.width)}"/>`;
  }
  if (p.type === 'polygon') {
    return `<polygon points="${pts(p.points)}" fill="${p.color}" stroke="${p.color}" stroke-width="0.4" stroke-linejoin="round"/>`;
  }
  const fill = p.fill ?? 'none';
  const stroke = p.width > 0 ? ` stroke="${p.color}" stroke-width="${f(p.width)}"` : '';
  return `<circle cx="${f(p.center.x)}" cy="${f(p.center.y)}" r="${f(p.r)}" fill="${fill}"${stroke}/>`;
}

export function toSVG(d: Drawing, opts: SvgOptions = {}): string {
  const { viewBox: vb, style } = d;
  const k = opts.scale ?? 1;
  const parts: string[] = [];
  const title = opts.title ?? d.molecule.title;
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.width)} ${f(vb.height)}" ` +
      `width="${f(vb.width * k)}" height="${f(vb.height * k)}" role="img"` +
      (title ? ` aria-label="${esc(title)}"` : '') +
      (opts.className ? ` class="${esc(opts.className)}"` : '') +
      '>',
  );
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (opts.background) {
    parts.push(`<rect x="${f(vb.x)}" y="${f(vb.y)}" width="${f(vb.width)}" height="${f(vb.height)}" fill="${opts.background}"/>`);
  }
  if (d.underlay.length) {
    parts.push(`<g stroke-linecap="round" opacity="0.32">${d.underlay.map(primToSvg).join('')}</g>`);
  }
  parts.push(`<g stroke-linecap="round" stroke-linejoin="round" fill="none">`);
  for (const p of d.primitives) parts.push(primToSvg(p));
  parts.push('</g>');
  if (d.labels.length) {
    parts.push(
      `<g font-family="${esc(style.fontFamily)}" font-weight="${style.fontWeight}" style="font-kerning:none" text-rendering="geometricPrecision">`,
    );
    for (const label of d.labels) {
      const spans = label.runs
        .map((r) => `<tspan x="${f(r.x)}" y="${f(r.y)}" font-size="${f(r.size)}">${esc(r.text)}</tspan>`)
        .join('');
      parts.push(`<text fill="${label.color}">${spans}</text>`);
    }
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('');
}
