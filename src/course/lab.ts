/**
 * The reactions a molecule can go through, for the studio's reaction lab: every
 * product is computed by the reaction engine, so students can try any structure.
 */
import { benzeneRings, hydrocarbonClass } from '../chem/analysis.ts';
import * as rx from '../chem/reactions.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';
import { decimal } from './kit.ts';
import type { MolSpec, Scheme, Term } from './types.ts';

export interface LabReaction {
  id: string;
  name: string;
  scheme: Scheme;
  /** The organic product to open in the editor next. */
  product?: MolSpec;
  /** One line on what happened. */
  note: string;
}

const m = (smiles: string, extra: Partial<MolSpec> = {}, coef?: string): Term => ({ mol: { smiles, ...extra }, coef });
const t = (text: string, coef?: string): Term => ({ text, coef });
const coefText = (n: number) => (n === 1 ? undefined : decimal(n));

/** Each reaction is tried on its own, so one that does not apply never hides the others. */
function attempt(out: LabReaction[], make: () => LabReaction | undefined) {
  try {
    const r = make();
    if (r) out.push(r);
  } catch {
    // Not applicable to this structure.
  }
}

export function labReactions(smiles: string): LabReaction[] {
  const mol = moleculeFromSmiles(smiles);
  if (mol.components().length !== 1 || mol.atoms.some((a) => a.element === '*')) return [];
  const out: LabReaction[] = [];
  const doubles = rx.carbonMultipleBonds(mol, 2);
  const triples = rx.carbonMultipleBonds(mol, 3);
  const alcohols = rx.alcohols(mol);
  const acids = rx.carboxyls(mol);
  const esters = rx.esters(mol);

  if (doubles.length + triples.length > 0) {
    attempt(out, () => {
      const product = rx.hydrogenate(smiles);
      const h2 = rx.h2ToSaturate(smiles);
      return {
        id: 'h2',
        name: 'Hidrogenação',
        scheme: { left: [m(smiles), t('H₂', coefText(h2))], right: [m(product)], over: 'Ni' },
        product: { smiles: product },
        note: `Cada dupla C=C recebe 1 H₂ e cada tripla, 2: ${h2} H₂ no total.`,
      };
    });
  }
  if (doubles.length === 1 && !triples.length) {
    for (const reagent of ['Br2', 'HBr', 'H2O'] as const) {
      attempt(out, () => {
        const product = rx.addition(smiles, reagent);
        if (!product) return undefined;
        const names = { Br2: 'Adição de Br₂', HBr: 'Adição de HBr', H2O: 'Hidratação' };
        const notes = {
          Br2: 'Um Br em cada carbono da dupla: o bromo descora.',
          HBr: 'O H vai para o carbono da dupla com mais hidrogênios (Markovnikov).',
          H2O: 'Em meio ácido, H e OH se somam à dupla (Markovnikov): forma-se um álcool.',
        };
        return {
          id: reagent,
          name: names[reagent],
          scheme: { left: [m(smiles), t(rx.REAGENT_TEXT[reagent])], right: [m(product)], over: reagent === 'H2O' ? 'H⁺' : undefined },
          product: { smiles: product },
          note: notes[reagent],
        };
      });
    }
    attempt(out, () => {
      // Addition monomers are small vinyl compounds (CH₂=CHX) or perhalogenated (CF₂=CF₂).
      const [bond] = doubles;
      const ends = [bond.a, bond.b].map((i) => mol.atoms[i]);
      const perhalo = [bond.a, bond.b].every((i) => mol.neighbors(i).every((n) => n === bond.a || n === bond.b || ['F', 'Cl'].includes(mol.atoms[n].element)));
      if (mol.atoms.length > 12 || !(ends.some((a) => a.hydrogens === 2) || perhalo)) return undefined;
      const repeat = rx.additionPolymer(smiles);
      return {
        id: 'polymer',
        name: 'Polimerização',
        scheme: { left: [m(smiles, {}, 'n')], right: [{ mol: { smiles: repeat, polymer: true, formula: moleculeFromSmiles(repeat).rings.length ? 'skeletal' : 'condensed' } }] },
        note: 'A dupla se abre e as moléculas se ligam em cadeia: polímero de adição.',
      };
    });
  }
  if (alcohols.length === 1 && !acids.length) {
    attempt(out, () => {
      const product = rx.oxidizeAlcohol(smiles, 'energica');
      const kind = alcohols[0].kind;
      if (!product) {
        return {
          id: 'ox',
          name: 'Oxidação',
          scheme: { left: [m(smiles)], right: [t('não reage')], over: '[O]', under: 'KMnO₄ / H⁺' },
          note: 'Álcool terciário: o carbono do –OH não tem H para perder.',
        };
      }
      return {
        id: 'ox',
        name: 'Oxidação',
        scheme: { left: [m(smiles)], right: [m(product)], over: '[O]', under: 'KMnO₄ / H⁺' },
        product: { smiles: product },
        note: kind === 'primário' ? 'Álcool primário: aldeído e, com excesso de oxidante, ácido carboxílico.' : 'Álcool secundário: cetona.',
      };
    });
    attempt(out, () => {
      const product = rx.dehydration(smiles);
      if (!product) return undefined;
      return {
        id: 'dehydration',
        name: 'Desidratação',
        scheme: { left: [m(smiles)], right: [m(product), t('H₂O')], over: 'H₂SO₄', under: '170 °C' },
        product: { smiles: product },
        note: 'O –OH e um H do carbono vizinho saem como água: forma-se o alceno mais substituído.',
      };
    });
  }
  if (acids.length === 1 && !alcohols.length) {
    attempt(out, () => {
      const product = rx.esterify(smiles, 'CCO');
      return {
        id: 'ester',
        name: 'Esterificação',
        scheme: { left: [m(smiles), m('CCO', { name: 'etanol' })], right: [m(product), t('H₂O')], over: 'H⁺', reversible: true },
        product: { smiles: product },
        note: 'Ácido + álcool ⇌ éster + água; o O da ponte vem do álcool.',
      };
    });
    attempt(out, () => {
      const product = rx.carboxylateSalt(smiles);
      return {
        id: 'salt',
        name: 'Neutralização',
        scheme: { left: [m(smiles), t('NaOH')], right: [m(product), t('H₂O')] },
        product: { smiles: product },
        note: 'O ácido perde o H⁺ para a base e vira um sal orgânico (carboxilato).',
      };
    });
  }
  if (esters.length) {
    for (const medium of ['ácido', 'básico'] as const) {
      attempt(out, () => {
        const { acids: a, alcohols: b } = rx.hydrolyzeEsters(smiles, medium);
        const right = [...a, ...b].map((p) => m(p.smiles, {}, p.count > 1 ? String(p.count) : undefined));
        return {
          id: `hyd-${medium}`,
          name: medium === 'ácido' ? 'Hidrólise ácida' : 'Saponificação',
          scheme: {
            left: [m(smiles), t(medium === 'ácido' ? 'H₂O' : 'NaOH', esters.length > 1 ? String(esters.length) : undefined)],
            right,
            over: medium === 'ácido' ? 'H⁺' : undefined,
          },
          product: { smiles: a[0].smiles },
          note: medium === 'ácido' ? 'A água quebra o éster em ácido e álcool.' : 'Em base, sai o sal do ácido (sabão, se a cadeia for longa) e o álcool.',
        };
      });
    }
  }
  const hc = hydrocarbonClass(mol);
  if (hc === 'alcano' || hc === 'cicloalcano') {
    attempt(out, () => {
      const main = rx.mainBromination(smiles);
      if (!main) return undefined;
      return {
        id: 'br-light',
        name: 'Bromação (luz)',
        scheme: { left: [m(smiles), t('Br₂')], right: [m(main.smiles), t('HBr')], over: 'luz' },
        product: { smiles: main.smiles },
        note: `O Br troca o H do carbono mais substituído (aqui, ${main.carbonClass}).`,
      };
    });
  }
  if (benzeneRings(mol).length === 1) {
    attempt(out, () => {
      const dir = rx.director(smiles);
      const position: rx.RingPosition | undefined = dir === 'meta' ? 'meta' : dir === 'orto-para' ? 'para' : undefined;
      const product = rx.aromaticSubstitution(smiles, 'NO2', position);
      return {
        id: 'nitration',
        name: 'Nitração',
        scheme: { left: [m(smiles), t('HNO₃')], right: [m(product), t('H₂O')], over: 'H₂SO₄' },
        product: { smiles: product },
        note: dir ? `O grupo do anel é ${dir === 'meta' ? 'meta' : 'orto-para'}-dirigente${dir === 'meta' ? '' : ' (mostrado o produto para)'}.` : 'Um H do anel é trocado por –NO₂.',
      };
    });
  }
  attempt(out, () => {
    const c = rx.combustion(smiles);
    // Whole-number coefficients, as the equation is usually written.
    const k = Number.isInteger(c.o2) ? 1 : 2;
    return {
      id: 'combustion',
      name: 'Combustão',
      scheme: {
        left: [m(smiles, {}, k > 1 ? String(k) : undefined), t('O₂', coefText(c.o2 * k))],
        right: [t('CO₂', coefText(c.co2 * k)), t('H₂O', coefText(c.h2o * k))],
      },
      note: `Combustão completa: ${decimal(c.o2)} O₂ por mol do combustível.`,
    };
  });
  return out;
}
