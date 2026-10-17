/** Curated molecules per topic, with IUPAC names as used in Brazilian textbooks. */

export interface Named {
  smiles: string;
  name: string;
}

export const ALKANES: Named[] = [
  { smiles: 'CC', name: 'etano' },
  { smiles: 'CCC', name: 'propano' },
  { smiles: 'CCCC', name: 'butano' },
  { smiles: 'CCCCC', name: 'pentano' },
  { smiles: 'CCCCCC', name: 'hexano' },
  { smiles: 'CCCCCCC', name: 'heptano' },
  { smiles: 'CC(C)C', name: 'metilpropano' },
  { smiles: 'CC(C)CC', name: '2-metilbutano' },
  { smiles: 'CC(C)(C)C', name: '2,2-dimetilpropano' },
  { smiles: 'CC(C)CCC', name: '2-metilpentano' },
  { smiles: 'CCC(C)CC', name: '3-metilpentano' },
  { smiles: 'CC(C)C(C)C', name: '2,3-dimetilbutano' },
  { smiles: 'CC(C)(C)CC', name: '2,2-dimetilbutano' },
  { smiles: 'CC(C)CC(C)(C)C', name: '2,2,4-trimetilpentano' },
  { smiles: 'CCC(C)(CC)CC', name: '3-etil-3-metilpentano' },
];

export const ALKENES: Named[] = [
  { smiles: 'C=C', name: 'eteno' },
  { smiles: 'C=CC', name: 'propeno' },
  { smiles: 'C=CCC', name: 'but-1-eno' },
  { smiles: 'CC=CC', name: 'but-2-eno' },
  { smiles: 'C=CCCC', name: 'pent-1-eno' },
  { smiles: 'CC=CCC', name: 'pent-2-eno' },
  { smiles: 'C=C(C)C', name: 'metilpropeno' },
  { smiles: 'C=CC=C', name: 'buta-1,3-dieno' },
];

export const ALKYNES: Named[] = [
  { smiles: 'C#C', name: 'etino' },
  { smiles: 'C#CC', name: 'propino' },
  { smiles: 'C#CCC', name: 'but-1-ino' },
  { smiles: 'CC#CC', name: 'but-2-ino' },
  { smiles: 'C#CCCC', name: 'pent-1-ino' },
];

export const CYCLIC: Named[] = [
  { smiles: 'C1CC1', name: 'ciclopropano' },
  { smiles: 'C1CCC1', name: 'ciclobutano' },
  { smiles: 'C1CCCC1', name: 'ciclopentano' },
  { smiles: 'C1CCCCC1', name: 'cicloexano' },
  { smiles: 'CC1CCCCC1', name: 'metilcicloexano' },
  { smiles: 'C1=CCCCC1', name: 'cicloexeno' },
];

export const AROMATIC: Named[] = [
  { smiles: 'c1ccccc1', name: 'benzeno' },
  { smiles: 'Cc1ccccc1', name: 'metilbenzeno (tolueno)' },
  { smiles: 'CCc1ccccc1', name: 'etilbenzeno' },
  { smiles: 'Cc1ccccc1C', name: '1,2-dimetilbenzeno' },
  { smiles: 'c1ccc2ccccc2c1', name: 'naftaleno' },
];

export const HYDROCARBONS: Named[] = [...ALKANES, ...ALKENES, ...ALKYNES, ...CYCLIC, ...AROMATIC];

/** Chains that are good for classification questions (mix of every kind). */
export const CHAINS: Named[] = [
  ...ALKANES.slice(2),
  ...ALKENES.slice(1),
  ...ALKYNES.slice(1),
  ...CYCLIC,
  ...AROMATIC.slice(0, 3),
  { smiles: 'CCOCC', name: 'etoxietano' },
  { smiles: 'COC(C)C', name: '2-metoxipropano' },
  { smiles: 'CCNCC', name: 'dietilamina' },
  { smiles: 'CCN(C)C', name: 'N,N-dimetiletanamina' },
  { smiles: 'CCOC(C)=O', name: 'etanoato de etila' },
  { smiles: 'CCCO', name: 'propan-1-ol' },
  { smiles: 'CC(C)O', name: 'propan-2-ol' },
  { smiles: 'CC(C)C=O', name: 'metilpropanal' },
  { smiles: 'C1CCOC1', name: 'oxolano' },
  { smiles: 'C1CCNCC1', name: 'piperidina' },
  { smiles: 'CSC', name: 'metiltiometano' },
  { smiles: 'C=CC(C)C', name: '3-metilbut-1-eno' },
];

/** Simple representatives of each organic function. */
export const FUNCTION_EXAMPLES: Named[] = [
  { smiles: 'CO', name: 'metanol' },
  { smiles: 'CCO', name: 'etanol' },
  { smiles: 'CC(C)O', name: 'propan-2-ol' },
  { smiles: 'OCC(O)CO', name: 'glicerol' },
  { smiles: 'Oc1ccccc1', name: 'fenol' },
  { smiles: 'Cc1ccc(O)cc1', name: '4-metilfenol' },
  { smiles: 'C=CO', name: 'etenol' },
  { smiles: 'C=O', name: 'metanal' },
  { smiles: 'CC=O', name: 'etanal' },
  { smiles: 'CCC=O', name: 'propanal' },
  { smiles: 'O=Cc1ccccc1', name: 'benzaldeído' },
  { smiles: 'CC(C)=O', name: 'propanona' },
  { smiles: 'CCC(C)=O', name: 'butanona' },
  { smiles: 'O=C1CCCCC1', name: 'cicloexanona' },
  { smiles: 'OC=O', name: 'ácido metanoico' },
  { smiles: 'CC(=O)O', name: 'ácido etanoico' },
  { smiles: 'CCC(=O)O', name: 'ácido propanoico' },
  { smiles: 'OC(=O)c1ccccc1', name: 'ácido benzoico' },
  { smiles: 'COC(C)=O', name: 'etanoato de metila' },
  { smiles: 'CCOC(C)=O', name: 'etanoato de etila' },
  { smiles: 'CCOC=O', name: 'metanoato de etila' },
  { smiles: 'CCCCOC(C)=O', name: 'etanoato de butila' },
  { smiles: 'COC', name: 'metoximetano' },
  { smiles: 'CCOCC', name: 'etoxietano' },
  { smiles: 'COCC', name: 'metoxietano' },
  { smiles: 'COc1ccccc1', name: 'metoxibenzeno' },
  { smiles: 'CN', name: 'metanamina' },
  { smiles: 'CCN', name: 'etanamina' },
  { smiles: 'CNC', name: 'N-metilmetanamina' },
  { smiles: 'CN(C)C', name: 'N,N-dimetilmetanamina' },
  { smiles: 'Nc1ccccc1', name: 'fenilamina' },
  { smiles: 'NC=O', name: 'metanamida' },
  { smiles: 'CC(N)=O', name: 'etanamida' },
  { smiles: 'NC(N)=O', name: 'ureia' },
  { smiles: 'CC#N', name: 'etanonitrila' },
  { smiles: 'CCC#N', name: 'propanonitrila' },
  { smiles: 'C[N+](=O)[O-]', name: 'nitrometano' },
  { smiles: '[O-][N+](=O)c1ccccc1', name: 'nitrobenzeno' },
  { smiles: 'CCl', name: 'clorometano' },
  { smiles: 'ClC(Cl)Cl', name: 'triclorometano' },
  { smiles: 'CCBr', name: 'bromoetano' },
  { smiles: 'Clc1ccccc1', name: 'clorobenzeno' },
  { smiles: 'CC(=O)[O-].[Na+]', name: 'etanoato de sódio' },
];

/** Alkenes with a written configuration; `cis` refers to the main-chain carbons. */
export const GEOMETRIC: Array<Named & { cis: boolean }> = [
  { smiles: 'C/C=C\\C', name: 'cis-but-2-eno', cis: true },
  { smiles: 'C/C=C/C', name: 'trans-but-2-eno', cis: false },
  { smiles: 'C/C=C\\CC', name: 'cis-pent-2-eno', cis: true },
  { smiles: 'C/C=C/CC', name: 'trans-pent-2-eno', cis: false },
  { smiles: 'Cl/C=C\\Cl', name: 'cis-1,2-dicloroeteno', cis: true },
  { smiles: 'Cl/C=C/Cl', name: 'trans-1,2-dicloroeteno', cis: false },
  { smiles: 'OC(=O)/C=C\\C(=O)O', name: 'ácido maleico', cis: true },
  { smiles: 'OC(=O)/C=C/C(=O)O', name: 'ácido fumárico', cis: false },
  { smiles: 'CC/C=C\\CC', name: 'cis-hex-3-eno', cis: true },
  { smiles: 'CC/C=C/CC', name: 'trans-hex-3-eno', cis: false },
  { smiles: 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', name: 'ácido oleico', cis: true },
  { smiles: 'CCCCCCCC/C=C/CCCCCCCC(=O)O', name: 'ácido elaídico', cis: false },
];

/** Alkenes for "does it show cis/trans isomerism?" */
export const MAYBE_GEOMETRIC: Named[] = [
  { smiles: 'CC=CC', name: 'but-2-eno' },
  { smiles: 'C=CC', name: 'propeno' },
  { smiles: 'CC(C)=CC', name: '2-metilbut-2-eno' },
  { smiles: 'ClC=CCl', name: '1,2-dicloroeteno' },
  { smiles: 'C=CCl', name: 'cloroeteno' },
  { smiles: 'CCC=CC', name: 'pent-2-eno' },
  { smiles: 'C=C(C)C', name: 'metilpropeno' },
  { smiles: 'CC=CC(=O)O', name: 'ácido but-2-enoico' },
  { smiles: 'ClC(Cl)=CC', name: '1,1-dicloropropeno' },
  { smiles: 'BrC=CCl', name: '1-bromo-2-cloroeteno' },
];

/** Molecules with zero to a few chiral carbons. */
export const CHIRAL: Named[] = [
  { smiles: 'CC(O)C(=O)O', name: 'ácido lático' },
  { smiles: 'CC(N)C(=O)O', name: 'alanina' },
  { smiles: 'CCC(C)O', name: 'butan-2-ol' },
  { smiles: 'CCC(C)Cl', name: '2-clorobutano' },
  { smiles: 'CC(C)O', name: 'propan-2-ol' },
  { smiles: 'OCC(O)CO', name: 'glicerol' },
  { smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', name: 'ibuprofeno' },
  { smiles: 'CNCC(O)c1ccc(O)c(O)c1', name: 'adrenalina' },
  { smiles: 'CC1=CCC(CC1=O)C(=C)C', name: 'carvona' },
  { smiles: 'CC(C)C1CCC(C)CC1O', name: 'mentol' },
  { smiles: 'OC(C(=O)O)C(O)C(=O)O', name: 'ácido tartárico' },
  { smiles: 'CC(Br)C(C)Cl', name: '2-bromo-3-clorobutano' },
  { smiles: 'CCC(C)CC', name: '3-metilpentano' },
  { smiles: 'CCC(C)CCC', name: '3-metil-hexano' },
];

/** Everyday ENEM molecules for the "functions in real life" lesson. */
export const EVERYDAY = [
  'aspirina',
  'paracetamol',
  'ibuprofeno',
  'vanilina',
  'eugenol',
  'capsaicina',
  'adrenalina',
  'dopamina',
  'acido-lactico',
  'acetato-de-etila',
  'testosterona',
  'carvona',
  'mentol',
  'acido-citrico',
  'glicose',
];
