/** The molecular graph shared by the parser, perception, layout and depiction stages. */

export type Chirality = '@' | '@@';
export type BondDisplay = 'plain' | 'wedge' | 'hash' | 'wavy';

export interface Atom {
  index: number;
  /** Element symbol ('C', 'Cl', ...). '*' is a generic substituent R. */
  element: string;
  aromatic: boolean;
  charge: number;
  isotope?: number;
  /** Total hydrogen count (explicit for bracket atoms, inferred otherwise). */
  hydrogens: number;
  /** Bracket atoms carry an exact hydrogen count; organic-subset atoms get one inferred. */
  bracket: boolean;
  chirality?: Chirality;
  /**
   * Neighbour order as written in the SMILES string, used to interpret @/@@.
   * The value -1 stands for the atom's implicit/bracket hydrogen.
   */
  stereoOrder?: number[];
  /** Atom-map/class number from SMILES ([C:1]); for '*' it becomes the R subscript. */
  mapNumber?: number;
  /** Optional free-text label that replaces the element symbol when drawn (e.g. "R", "Ph"). */
  label?: string;
  /** Condensed group drawn in place of several atoms ("COOH" / "HOOC" by reading direction). */
  abbreviation?: { right: string; left: string };
  /** Index of the atom this one was derived from when a molecule is rewritten for drawing. */
  source?: number;
  /** Original atoms folded into this one (abbreviations). */
  members?: number[];
}

export interface Bond {
  index: number;
  a: number;
  b: number;
  /** 1, 2 or 3 after kekulisation. Aromatic bonds are 1 or 2 with `aromatic` kept as a flag. */
  order: number;
  aromatic: boolean;
  /** Directional single bond marks from SMILES ('/' or '\\'), relative to the a -> b direction. */
  direction?: '/' | '\\';
  /** Stereo display, drawn from atom a (narrow end) to atom b. */
  display: BondDisplay;
}

/** A cis/trans requirement on a double bond a=b: atom x (on a) and atom y (on b) are cis or trans. */
export interface DoubleBondStereo {
  bond: number;
  a: number;
  b: number;
  x: number;
  y: number;
  cis: boolean;
}

export class Molecule {
  atoms: Atom[] = [];
  bonds: Bond[] = [];
  /** adjacency[i] = list of bond indices touching atom i */
  adjacency: number[][] = [];
  doubleBondStereo: DoubleBondStereo[] = [];
  /** Smallest set of smallest rings (atom indices in ring order). Filled by perception. */
  rings: number[][] = [];
  title?: string;

  addAtom(partial: Partial<Atom> & { element: string }): number {
    const index = this.atoms.length;
    this.atoms.push({
      aromatic: false,
      charge: 0,
      hydrogens: 0,
      bracket: false,
      ...partial,
      // Copies of atoms from another molecule get their new position here.
      index,
    });
    this.adjacency.push([]);
    return index;
  }

  addBond(a: number, b: number, order = 1, aromatic = false): number {
    const index = this.bonds.length;
    this.bonds.push({ index, a, b, order, aromatic, display: 'plain' });
    this.adjacency[a].push(index);
    this.adjacency[b].push(index);
    return index;
  }

  other(bond: Bond | number, atom: number): number {
    const b = typeof bond === 'number' ? this.bonds[bond] : bond;
    return b.a === atom ? b.b : b.a;
  }

  neighbors(atom: number): number[] {
    return this.adjacency[atom].map((bi) => this.other(bi, atom));
  }

  bondBetween(i: number, j: number): Bond | undefined {
    for (const bi of this.adjacency[i]) {
      const b = this.bonds[bi];
      if ((b.a === i && b.b === j) || (b.a === j && b.b === i)) return b;
    }
    return undefined;
  }

  degree(atom: number): number {
    return this.adjacency[atom].length;
  }

  /** Sum of bond orders to heavy neighbours. */
  bondOrderSum(atom: number): number {
    let s = 0;
    for (const bi of this.adjacency[atom]) s += this.bonds[bi].order;
    return s;
  }

  /** Connected components as lists of atom indices. */
  components(): number[][] {
    const seen = new Array<boolean>(this.atoms.length).fill(false);
    const out: number[][] = [];
    for (let s = 0; s < this.atoms.length; s++) {
      if (seen[s]) continue;
      const comp: number[] = [];
      const stack = [s];
      seen[s] = true;
      while (stack.length) {
        const v = stack.pop()!;
        comp.push(v);
        for (const w of this.neighbors(v)) {
          if (!seen[w]) {
            seen[w] = true;
            stack.push(w);
          }
        }
      }
      out.push(comp.sort((p, q) => p - q));
    }
    return out;
  }

  /** Molecular formula in Hill order, e.g. "C2H6O". */
  formula(): string {
    const counts = new Map<string, number>();
    const bump = (el: string, n: number) => counts.set(el, (counts.get(el) ?? 0) + n);
    for (const a of this.atoms) {
      if (a.element !== '*') bump(a.element, 1);
      if (a.hydrogens) bump('H', a.hydrogens);
    }
    const parts: string[] = [];
    const take = (el: string) => {
      const n = counts.get(el);
      if (!n) return;
      parts.push(n === 1 ? el : `${el}${n}`);
      counts.delete(el);
    };
    if (counts.has('C')) {
      take('C');
      take('H');
    }
    for (const el of [...counts.keys()].sort()) take(el);
    let charge = 0;
    for (const a of this.atoms) charge += a.charge;
    const sign = charge > 0 ? '+' : '-';
    const chargeText = charge === 0 ? '' : Math.abs(charge) === 1 ? sign : `${Math.abs(charge)}${sign}`;
    return parts.join('') + chargeText;
  }
}
