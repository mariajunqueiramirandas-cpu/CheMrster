/**
 * OpenSMILES parser. Supports the organic subset, bracket atoms (isotope, chirality,
 * hydrogen count, charge, atom class), all bond symbols, branches, ring closures
 * (including %nn) and disconnected fragments. Output is the raw graph; call
 * `perceive` (see perception.ts) to kekulise and infer hydrogens.
 */
import { Molecule, type Chirality } from './molecule.ts';

export class SmilesError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(`${message} (posição ${position + 1})`);
    this.name = 'SmilesError';
    this.position = position;
  }
}

// prettier-ignore
const ALL_SYMBOLS = new Set((
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb ' +
  'Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'
).split(' '));

const BRACKET_AROMATIC = ['se', 'as', 'te', 'b', 'c', 'n', 'o', 'p', 's'];

interface BondSpec {
  symbol: string;
  position: number;
}

interface OpenRing {
  atom: number;
  spec: BondSpec | null;
  position: number;
}

const RING_PLACEHOLDER = -1000;

export function parseSmiles(smiles: string): Molecule {
  const mol = new Molecule();
  const s = smiles.trim();
  const orders: number[][] = [];
  const openRings = new Map<number, OpenRing>();
  const branchStack: number[] = [];
  let prev = -1;
  let pending: BondSpec | null = null;
  let i = 0;

  const fail = (msg: string, at = i): never => {
    throw new SmilesError(msg, at);
  };

  const connect = (a: number, b: number, spec: BondSpec | null, ringClosure = false) => {
    if (a === b) fail('Átomo ligado a si mesmo');
    if (mol.bondBetween(a, b)) fail('Ligação duplicada entre os mesmos átomos');
    const both = mol.atoms[a].aromatic && mol.atoms[b].aromatic;
    let order = 1;
    let aromatic = false;
    let direction: '/' | '\\' | undefined;
    switch (spec?.symbol) {
      case undefined:
        aromatic = both;
        break;
      case '-':
        break;
      case '=':
        order = 2;
        break;
      case '#':
        order = 3;
        break;
      case '$':
        order = 4;
        break;
      case ':':
        aromatic = true;
        break;
      case '/':
      case '\\':
        direction = spec.symbol;
        break;
    }
    const bi = mol.addBond(a, b, order, aromatic);
    if (direction) mol.bonds[bi].direction = direction;
    if (!ringClosure) {
      orders[a].push(b);
      orders[b].push(a);
    }
  };

  const newAtom = (
    element: string,
    opts: {
      aromatic?: boolean;
      bracket?: boolean;
      hydrogens?: number;
      charge?: number;
      isotope?: number;
      chirality?: Chirality;
      mapNumber?: number;
    },
  ) => {
    const idx = mol.addAtom({
      element,
      aromatic: opts.aromatic ?? false,
      bracket: opts.bracket ?? false,
      hydrogens: opts.hydrogens ?? 0,
      charge: opts.charge ?? 0,
      isotope: opts.isotope,
      chirality: opts.chirality,
      mapNumber: opts.mapNumber,
    });
    orders.push([]);
    if (prev >= 0) connect(prev, idx, pending);
    if (opts.chirality && (opts.hydrogens ?? 0) > 0) orders[idx].push(-1);
    pending = null;
    prev = idx;
  };

  const readNumber = () => {
    const start = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    return start === i ? undefined : Number(s.slice(start, i));
  };

  const parseBracket = () => {
    i++; // '['
    const isotope = readNumber();
    let element: string;
    let aromatic = false;
    if (s[i] === '*') {
      element = '*';
      i++;
    } else {
      const aro = BRACKET_AROMATIC.find((sym) => s.startsWith(sym, i));
      if (aro) {
        element = aro.length === 1 ? aro.toUpperCase() : aro[0].toUpperCase() + aro[1];
        aromatic = true;
        i += aro.length;
      } else if (/[A-Z]/.test(s[i] ?? '')) {
        const two = s.slice(i, i + 2);
        if (/^[A-Z][a-z]$/.test(two) && ALL_SYMBOLS.has(two)) {
          element = two;
          i += 2;
        } else {
          element = s[i];
          if (!ALL_SYMBOLS.has(element)) fail(`Elemento desconhecido "${element}"`);
          i++;
        }
      } else {
        return fail('Símbolo de elemento esperado dentro de colchetes');
      }
    }
    let chirality: Chirality | undefined;
    if (s[i] === '@') {
      i++;
      if (s[i] === '@') {
        i++;
        chirality = '@@';
      } else {
        chirality = '@';
      }
      // Ignore extended chirality classes (@TH1, @SP2, ...) but keep the basic sense.
      if (/^(TH|AL|SP|TB|OH)/.test(s.slice(i))) {
        i += 2;
        readNumber();
      }
    }
    let hydrogens = 0;
    if (s[i] === 'H') {
      i++;
      hydrogens = readNumber() ?? 1;
    }
    let charge = 0;
    if (s[i] === '+' || s[i] === '-') {
      const sign = s[i] === '+' ? 1 : -1;
      const ch = s[i];
      i++;
      const n = readNumber();
      if (n !== undefined) {
        charge = sign * n;
      } else {
        charge = sign;
        while (s[i] === ch) {
          charge += sign;
          i++;
        }
      }
    }
    let mapNumber: number | undefined;
    if (s[i] === ':') {
      i++;
      mapNumber = readNumber();
      if (mapNumber === undefined) fail('Número de classe esperado após ":"');
    }
    if (s[i] !== ']') fail('"]" esperado', i);
    i++;
    newAtom(element, { aromatic, bracket: true, hydrogens, charge, isotope, chirality, mapNumber });
  };

  while (i < s.length) {
    const c = s[i];
    if (c === '[') {
      parseBracket();
      continue;
    }
    if (c === '*') {
      i++;
      newAtom('*', {});
      continue;
    }
    if (c === 'C' && s[i + 1] === 'l') {
      i += 2;
      newAtom('Cl', {});
      continue;
    }
    if (c === 'B' && s[i + 1] === 'r') {
      i += 2;
      newAtom('Br', {});
      continue;
    }
    if ('BCNOPSFI'.includes(c)) {
      i++;
      newAtom(c, {});
      continue;
    }
    if ('bcnops'.includes(c)) {
      i++;
      newAtom(c.toUpperCase(), { aromatic: true });
      continue;
    }
    if ('-=#$:/\\'.includes(c)) {
      if (pending) fail('Duas ligações seguidas');
      if (prev < 0) fail('Ligação sem átomo anterior');
      pending = { symbol: c, position: i };
      i++;
      continue;
    }
    if (c === '(') {
      if (prev < 0) fail('Ramificação sem átomo anterior');
      branchStack.push(prev);
      i++;
      continue;
    }
    if (c === ')') {
      if (!branchStack.length) fail('")" sem "(" correspondente');
      if (pending) fail('Ligação solta antes de ")"');
      prev = branchStack.pop()!;
      i++;
      continue;
    }
    if (c === '.') {
      if (pending) fail('Ligação solta antes de "."');
      prev = -1;
      i++;
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '%') {
      const at = i;
      let num: number;
      if (c === '%') {
        const digits = s.slice(i + 1, i + 3);
        if (!/^\d\d$/.test(digits)) fail('"%" deve ser seguido de dois dígitos');
        num = Number(digits);
        i += 3;
      } else {
        num = Number(c);
        i++;
      }
      if (prev < 0) fail('Fechamento de anel sem átomo', at);
      const open = openRings.get(num);
      if (open) {
        openRings.delete(num);
        const spec = pending ?? open.spec;
        if (pending && open.spec && pending.symbol !== open.spec.symbol) {
          const dirs = ['/', '\\'];
          if (!(dirs.includes(pending.symbol) && dirs.includes(open.spec.symbol))) {
            fail(`Ligações conflitantes no fechamento do anel ${num}`, at);
          }
        }
        // A direction written at the opening digit is relative to opener -> closer.
        const fromOpener = !pending && open.spec;
        if (fromOpener) connect(open.atom, prev, spec, true);
        else connect(prev, open.atom, spec, true);
        const slot = orders[open.atom].indexOf(RING_PLACEHOLDER - num);
        if (slot >= 0) orders[open.atom][slot] = prev;
        orders[prev].push(open.atom);
      } else {
        openRings.set(num, { atom: prev, spec: pending, position: at });
        orders[prev].push(RING_PLACEHOLDER - num);
      }
      pending = null;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\n') break; // SMILES may be followed by a title
    fail(`Caractere inesperado "${c}"`);
  }

  if (pending) fail('A cadeia termina com uma ligação solta', s.length - 1);
  if (prev < 0 && mol.atoms.length) fail('"." precisa ser seguido de um átomo', s.length - 1);
  if (branchStack.length) fail('"(" sem ")" correspondente', s.length - 1);
  for (const [num, open] of openRings) fail(`Anel ${num} não foi fechado`, open.position);

  const title = s.slice(i).trim();
  if (title) mol.title = title;

  for (const atom of mol.atoms) {
    if (atom.chirality) atom.stereoOrder = orders[atom.index].filter((n) => n >= -1);
    if (atom.element === '*' && atom.mapNumber !== undefined) atom.label = `R${atom.mapNumber}`;
  }
  return mol;
}
