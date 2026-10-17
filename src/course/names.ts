/**
 * Names of the substances that lessons compute as reaction products, looked up by
 * structure (canonical key), so an explanation can say "forma-se o 2-bromopropano".
 * Unknown structures simply go unnamed.
 */
import { canonicalKey } from '../chem/graph.ts';
import { ALCOHOLS, ALKANES, ALKENES, ALKYNES, AROMATIC, CHAINS, CHIRAL, CYCLIC, FUNCTION_EXAMPLES, type Named } from './pools.ts';

/** IUPAC names (as in Brazilian textbooks) of products that are not in the other pools. */
const PRODUCTS: Named[] = [
  // Halogenação de alcenos (X₂)
  { smiles: 'BrCCBr', name: '1,2-dibromoetano' },
  { smiles: 'CC(Br)CBr', name: '1,2-dibromopropano' },
  { smiles: 'CCC(Br)CBr', name: '1,2-dibromobutano' },
  { smiles: 'CC(Br)C(C)Br', name: '2,3-dibromobutano' },
  { smiles: 'CC(C)(Br)CBr', name: '1,2-dibromo-2-metilpropano' },
  { smiles: 'CCCC(Br)CBr', name: '1,2-dibromopentano' },
  { smiles: 'CC(Br)C(C)(C)Br', name: '2,3-dibromo-2-metilbutano' },
  { smiles: 'BrC1CCCCC1Br', name: '1,2-dibromocicloexano' },
  { smiles: 'BrCC(Br)c1ccccc1', name: '(1,2-dibromoetil)benzeno' },
  { smiles: 'ClCCCl', name: '1,2-dicloroetano' },
  { smiles: 'CC(Cl)CCl', name: '1,2-dicloropropano' },
  { smiles: 'CCC(Cl)CCl', name: '1,2-diclorobutano' },
  { smiles: 'CC(Cl)C(C)Cl', name: '2,3-diclorobutano' },
  { smiles: 'CC(C)(Cl)CCl', name: '1,2-dicloro-2-metilpropano' },
  { smiles: 'CCCC(Cl)CCl', name: '1,2-dicloropentano' },
  { smiles: 'CC(Cl)C(C)(C)Cl', name: '2,3-dicloro-2-metilbutano' },
  { smiles: 'ClC1CCCCC1Cl', name: '1,2-diclorocicloexano' },
  { smiles: 'ClCC(Cl)c1ccccc1', name: '(1,2-dicloroetil)benzeno' },
  // Adição de HX (Markovnikov) e bromação de alcanos
  { smiles: 'CC(C)Br', name: '2-bromopropano' },
  { smiles: 'CCC(C)Br', name: '2-bromobutano' },
  { smiles: 'CC(C)(C)Br', name: '2-bromo-2-metilpropano' },
  { smiles: 'CCCC(C)Br', name: '2-bromopentano' },
  { smiles: 'CCC(C)(C)Br', name: '2-bromo-2-metilbutano' },
  { smiles: 'BrC1CCCCC1', name: 'bromocicloexano' },
  { smiles: 'CC(Br)c1ccccc1', name: '(1-bromoetil)benzeno' },
  { smiles: 'CCC(C)(Br)CC', name: '3-bromo-3-metilpentano' },
  { smiles: 'CC(C)C(C)(C)Br', name: '2-bromo-2,3-dimetilbutano' },
  { smiles: 'CCCC(C)(C)Br', name: '2-bromo-2-metilpentano' },
  { smiles: 'CC1(Br)CCCCC1', name: '1-bromo-1-metilcicloexano' },
  { smiles: 'CC(C)(Br)CC(C)(C)C', name: '2-bromo-2,4,4-trimetilpentano' },
  { smiles: 'CC(Br)C(C)(C)C', name: '3-bromo-2,2-dimetilbutano' },
  { smiles: 'BrC1CCCC1', name: 'bromociclopentano' },
  { smiles: 'CCCl', name: 'cloroetano' },
  { smiles: 'CC(C)Cl', name: '2-cloropropano' },
  { smiles: 'CCC(C)Cl', name: '2-clorobutano' },
  { smiles: 'CC(C)(C)Cl', name: '2-cloro-2-metilpropano' },
  { smiles: 'CCCC(C)Cl', name: '2-cloropentano' },
  { smiles: 'CCC(C)(C)Cl', name: '2-cloro-2-metilbutano' },
  { smiles: 'ClC1CCCCC1', name: 'clorocicloexano' },
  { smiles: 'CC(Cl)c1ccccc1', name: '(1-cloroetil)benzeno' },
  // Hidratação de alcenos
  { smiles: 'CC(C)(C)O', name: '2-metilpropan-2-ol' },
  { smiles: 'CCCC(C)O', name: 'pentan-2-ol' },
  { smiles: 'CCC(C)(C)O', name: '2-metilbutan-2-ol' },
  { smiles: 'OC1CCCCC1', name: 'cicloexanol' },
  { smiles: 'CC(O)c1ccccc1', name: '1-feniletanol' },
  // Oxidação de álcoois
  { smiles: 'CCCC=O', name: 'butanal' },
  { smiles: 'CCCC(=O)O', name: 'ácido butanoico' },
  { smiles: 'CC(C)C(=O)O', name: 'ácido metilpropanoico' },
  { smiles: 'CCCCC=O', name: 'pentanal' },
  { smiles: 'CCCCC(=O)O', name: 'ácido pentanoico' },
  { smiles: 'CCCC(C)=O', name: 'pentan-2-ona' },
  { smiles: 'CCC(=O)CC', name: 'pentan-3-ona' },
];

let index: Map<string, string> | undefined;

/** The curated name of a structure, if it has one. */
export function nameOf(smiles: string): string | undefined {
  if (!index) {
    index = new Map();
    // Earlier lists win; stereo variants (cis/trans pools) are left out on purpose.
    for (const list of [PRODUCTS, ALKANES, ALKENES, ALKYNES, CYCLIC, AROMATIC, ALCOHOLS, FUNCTION_EXAMPLES, CHAINS, CHIRAL]) {
      for (const item of list) {
        const key = canonicalKey(item.smiles);
        if (!index.has(key)) index.set(key, item.name);
      }
    }
  }
  return index.get(canonicalKey(smiles));
}
