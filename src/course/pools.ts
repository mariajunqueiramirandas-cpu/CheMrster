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

// ---------------------------------------------------------------------------
// Unidade 6 — reações orgânicas

/** Alkenes with one C=C for addition questions (no rearrangement-prone ones). */
export const ADDITION_ALKENES: Named[] = [
  { smiles: 'C=C', name: 'eteno' },
  { smiles: 'C=CC', name: 'propeno' },
  { smiles: 'C=CCC', name: 'but-1-eno' },
  { smiles: 'CC=CC', name: 'but-2-eno' },
  { smiles: 'C=C(C)C', name: 'metilpropeno' },
  { smiles: 'C=CCCC', name: 'pent-1-eno' },
  { smiles: 'CC(C)=CC', name: '2-metilbut-2-eno' },
  { smiles: 'C1=CCCCC1', name: 'cicloexeno' },
  { smiles: 'C=Cc1ccccc1', name: 'vinilbenzeno (estireno)' },
];

/** Molecules with C=C and C≡C (but no benzene ring) for "how much H₂ saturates it?". */
export const UNSATURATED: Named[] = [
  { smiles: 'C=CC', name: 'propeno' },
  { smiles: 'C1=CCCCC1', name: 'cicloexeno' },
  { smiles: 'C=CC=C', name: 'buta-1,3-dieno' },
  { smiles: 'CC=CC=C', name: 'penta-1,3-dieno' },
  { smiles: 'C#C', name: 'etino' },
  { smiles: 'CC#CC', name: 'but-2-ino' },
  { smiles: 'C=CC#C', name: 'but-1-en-3-ino' },
  { smiles: 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', name: 'ácido oleico' },
  { smiles: 'CCCCC/C=C\\C/C=C\\CCCCCCCC(=O)O', name: 'ácido linoleico' },
  { smiles: 'CC/C=C\\C/C=C\\C/C=C\\CCCCCCCC(=O)O', name: 'ácido linolênico' },
  { smiles: 'CC(C)=CCCC(C)=CC=O', name: 'citral' },
];

/** Monosubstituted benzenes; `groups` are the substitutions that really work on them. */
export const ARENES: Array<Named & { sub: string; groups: Array<'NO2' | 'Cl' | 'Br'> }> = [
  { smiles: 'Cc1ccccc1', name: 'metilbenzeno (tolueno)', sub: '–CH₃', groups: ['NO2', 'Cl', 'Br'] },
  { smiles: 'CCc1ccccc1', name: 'etilbenzeno', sub: '–CH₂CH₃', groups: ['NO2', 'Br'] },
  { smiles: 'Oc1ccccc1', name: 'fenol', sub: '–OH', groups: ['NO2'] },
  { smiles: 'COc1ccccc1', name: 'metoxibenzeno', sub: '–OCH₃', groups: ['NO2', 'Br'] },
  { smiles: 'Clc1ccccc1', name: 'clorobenzeno', sub: '–Cl', groups: ['NO2'] },
  { smiles: 'Brc1ccccc1', name: 'bromobenzeno', sub: '–Br', groups: ['NO2'] },
  { smiles: 'Nc1ccccc1', name: 'fenilamina (anilina)', sub: '–NH₂', groups: [] },
  { smiles: '[O-][N+](=O)c1ccccc1', name: 'nitrobenzeno', sub: '–NO₂', groups: ['NO2', 'Br', 'Cl'] },
  { smiles: 'OC(=O)c1ccccc1', name: 'ácido benzoico', sub: '–COOH', groups: ['NO2', 'Br'] },
  { smiles: 'O=Cc1ccccc1', name: 'benzaldeído', sub: '–CHO', groups: ['NO2'] },
  { smiles: 'N#Cc1ccccc1', name: 'benzonitrila', sub: '–CN', groups: ['NO2'] },
  { smiles: 'CC(=O)c1ccccc1', name: 'feniletanona', sub: '–COCH₃', groups: ['NO2'] },
];

export const SATURATED_FOR_SUBSTITUTION: Named[] = [
  ...ALKANES,
  { smiles: 'C1CCCCC1', name: 'cicloexano' },
  { smiles: 'CC1CCCCC1', name: 'metilcicloexano' },
  { smiles: 'C1CCCC1', name: 'ciclopentano' },
];

export const ALCOHOLS: Named[] = [
  { smiles: 'CO', name: 'metanol' },
  { smiles: 'CCO', name: 'etanol' },
  { smiles: 'CCCO', name: 'propan-1-ol' },
  { smiles: 'CCCCO', name: 'butan-1-ol' },
  { smiles: 'CC(C)CO', name: '2-metilpropan-1-ol' },
  { smiles: 'CCCCCO', name: 'pentan-1-ol' },
  { smiles: 'OCc1ccccc1', name: 'fenilmetanol' },
  { smiles: 'CC(C)O', name: 'propan-2-ol' },
  { smiles: 'CCC(C)O', name: 'butan-2-ol' },
  { smiles: 'CCCC(C)O', name: 'pentan-2-ol' },
  { smiles: 'CCC(O)CC', name: 'pentan-3-ol' },
  { smiles: 'OC1CCCCC1', name: 'cicloexanol' },
  { smiles: 'CC(C)(C)O', name: '2-metilpropan-2-ol' },
  { smiles: 'CCC(C)(C)O', name: '2-metilbutan-2-ol' },
  { smiles: 'CCC(C)(O)CC', name: '3-metilpentan-3-ol' },
];

/** CxHyOz fuels for combustion balancing. */
export const FUELS: Named[] = [
  { smiles: 'C', name: 'metano' },
  { smiles: 'CC', name: 'etano' },
  { smiles: 'CCC', name: 'propano' },
  { smiles: 'CCCC', name: 'butano' },
  { smiles: 'CCCCCCCC', name: 'octano' },
  { smiles: 'C=C', name: 'eteno' },
  { smiles: 'C#C', name: 'etino (acetileno)' },
  { smiles: 'CO', name: 'metanol' },
  { smiles: 'CCO', name: 'etanol' },
  { smiles: 'CC(C)=O', name: 'propanona' },
  { smiles: 'c1ccccc1', name: 'benzeno' },
  { smiles: 'OCC(O)C(O)C(O)C(O)C=O', name: 'glicose' },
];

/** Linear acids and alcohols by carbon count, for ester names (1 = met-, 2 = et-...). */
export const PREFIX = ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];

export interface EsterPart {
  smiles: string;
  /** Carbon count of a straight chain, for names and swaps; undefined for benzoic acid or isoamyl. */
  n?: number;
  /** "ácido etanoico" / "etanol". */
  name: string;
  /** Piece of the ester name: "etanoato" (acid) or "etila" (alcohol). */
  part: string;
}

export const ESTER_ACIDS: EsterPart[] = [
  { smiles: 'OC=O', n: 1, name: 'ácido metanoico', part: 'metanoato' },
  { smiles: 'CC(=O)O', n: 2, name: 'ácido etanoico', part: 'etanoato' },
  { smiles: 'CCC(=O)O', n: 3, name: 'ácido propanoico', part: 'propanoato' },
  { smiles: 'CCCC(=O)O', n: 4, name: 'ácido butanoico', part: 'butanoato' },
  { smiles: 'OC(=O)c1ccccc1', name: 'ácido benzoico', part: 'benzoato' },
];

export const ESTER_ALCOHOLS: EsterPart[] = [
  { smiles: 'CO', n: 1, name: 'metanol', part: 'metila' },
  { smiles: 'CCO', n: 2, name: 'etanol', part: 'etila' },
  { smiles: 'CCCO', n: 3, name: 'propan-1-ol', part: 'propila' },
  { smiles: 'CCCCO', n: 4, name: 'butan-1-ol', part: 'butila' },
  { smiles: 'CCCCCO', n: 5, name: 'pentan-1-ol', part: 'pentila' },
  { smiles: 'CCCCCCCCO', n: 8, name: 'octan-1-ol', part: 'octila' },
  { smiles: 'CC(C)CCO', name: '3-metilbutan-1-ol', part: '3-metilbutila' },
];

/** Esters behind familiar smells (acid part, alcohol part, what it smells of). */
export const SCENTED_ESTERS: Array<{ acid: string; alcohol: string; scent: string }> = [
  { acid: 'etanoato', alcohol: '3-metilbutila', scent: 'aroma de banana' },
  { acid: 'butanoato', alcohol: 'etila', scent: 'aroma de abacaxi' },
  { acid: 'butanoato', alcohol: 'metila', scent: 'aroma de maçã' },
  { acid: 'etanoato', alcohol: 'octila', scent: 'aroma de laranja' },
  { acid: 'etanoato', alcohol: 'etila', scent: 'solvente de esmaltes' },
];

// ---------------------------------------------------------------------------
// Unidade 7 — polímeros e biomoléculas

export interface PolymerInfo {
  id: string;
  name: string;
  /** Sigla or common name, if any. */
  short?: string;
  kind: 'adição' | 'condensação';
  /** Monomers as SMILES and names (one for addition, one or two for condensation). */
  monomers: Array<{ smiles: string; name: string }>;
  use: string;
  /** Why it suits that use, in one line. */
  note: string;
}

export const POLYMERS: PolymerInfo[] = [
  { id: 'pe', name: 'polietileno', short: 'PE', kind: 'adição', monomers: [{ smiles: 'C=C', name: 'eteno' }], use: 'Sacolas plásticas e embalagens flexíveis', note: 'Leve, barato e flexível: é o plástico mais produzido do mundo.' },
  { id: 'pp', name: 'polipropileno', short: 'PP', kind: 'adição', monomers: [{ smiles: 'C=CC', name: 'propeno' }], use: 'Potes, tampas e para-choques', note: 'Mais rígido que o polietileno e resistente ao calor da água fervente.' },
  { id: 'pvc', name: 'policloreto de vinila', short: 'PVC', kind: 'adição', monomers: [{ smiles: 'C=CCl', name: 'cloroeteno' }], use: 'Canos e tubulações de água', note: 'O cloro deixa o plástico rígido e difícil de queimar; na queima libera HCl e dioxinas.' },
  { id: 'ps', name: 'poliestireno', short: 'PS', kind: 'adição', monomers: [{ smiles: 'C=Cc1ccccc1', name: 'vinilbenzeno (estireno)' }], use: 'Isopor e copos descartáveis', note: 'Na forma expandida, cheia de ar, vira o isopor, ótimo isolante térmico.' },
  { id: 'ptfe', name: 'politetrafluoroetileno', short: 'teflon', kind: 'adição', monomers: [{ smiles: 'FC(F)=C(F)F', name: 'tetrafluoroeteno' }], use: 'Revestimento antiaderente de panelas', note: 'As ligações C–F são muito fortes: quase nada reage com ele nem gruda nele.' },
  { id: 'pan', name: 'poliacrilonitrila', short: 'PAN', kind: 'adição', monomers: [{ smiles: 'C=CC#N', name: 'propenonitrila (acrilonitrila)' }], use: 'Fibras acrílicas de cobertores e roupas', note: 'Forma fibras macias e quentes, parecidas com a lã.' },
  { id: 'pva', name: 'poli(acetato de vinila)', short: 'PVA', kind: 'adição', monomers: [{ smiles: 'C=COC(C)=O', name: 'etanoato de etenila (acetato de vinila)' }], use: 'Cola branca e goma de mascar', note: 'Forma películas adesivas e pegajosas.' },
  { id: 'pmma', name: 'poli(metacrilato de metila)', short: 'acrílico', kind: 'adição', monomers: [{ smiles: 'C=C(C)C(=O)OC', name: 'metilpropenoato de metila' }], use: 'Placas de acrílico, lentes e letreiros', note: 'Transparente como o vidro, porém mais leve e muito mais resistente a impactos.' },
  {
    id: 'pet',
    name: 'poli(tereftalato de etileno)',
    short: 'PET',
    kind: 'condensação',
    monomers: [
      { smiles: 'OC(=O)c1ccc(cc1)C(=O)O', name: 'ácido tereftálico' },
      { smiles: 'OCCO', name: 'etano-1,2-diol (etilenoglicol)' },
    ],
    use: 'Garrafas de refrigerante e tecidos de poliéster',
    note: 'Transparente, leve e resistente; reciclado vira fibra para roupas.',
  },
  {
    id: 'nailon',
    name: 'náilon 6,6',
    kind: 'condensação',
    monomers: [
      { smiles: 'OC(=O)CCCCC(=O)O', name: 'ácido hexanodioico (adípico)' },
      { smiles: 'NCCCCCCN', name: 'hexano-1,6-diamina' },
    ],
    use: 'Fios, cordas e meias',
    note: 'As ligações de hidrogênio entre os grupos amida deixam os fios muito resistentes.',
  },
  {
    id: 'kevlar',
    name: 'kevlar',
    kind: 'condensação',
    monomers: [
      { smiles: 'OC(=O)c1ccc(cc1)C(=O)O', name: 'ácido tereftálico' },
      { smiles: 'Nc1ccc(N)cc1', name: 'benzeno-1,4-diamina' },
    ],
    use: 'Coletes à prova de balas',
    note: 'Cadeias rígidas e alinhadas, unidas por ligações de hidrogênio: cinco vezes mais resistente que o aço por massa.',
  },
  {
    id: 'pla',
    name: 'poli(ácido lático)',
    short: 'PLA',
    kind: 'condensação',
    monomers: [{ smiles: 'CC(O)C(=O)O', name: 'ácido lático' }],
    use: 'Plástico biodegradável de embalagens e fios de sutura',
    note: 'Feito do ácido lático da fermentação do milho ou da cana; microrganismos o degradam.',
  },
];

export interface FattyAcid extends Named {
  /** Saturated fats are solid at room temperature; cis-unsaturated oils are liquid. */
  doubleBonds: number;
  /** Its sodium salt, the soap. */
  soap: string;
}

export const FATTY_ACIDS: FattyAcid[] = [
  { smiles: 'CCCCCCCCCCCC(=O)O', name: 'ácido láurico', soap: 'laurato de sódio', doubleBonds: 0 },
  { smiles: 'CCCCCCCCCCCCCC(=O)O', name: 'ácido mirístico', soap: 'miristato de sódio', doubleBonds: 0 },
  { smiles: 'CCCCCCCCCCCCCCCC(=O)O', name: 'ácido palmítico', soap: 'palmitato de sódio', doubleBonds: 0 },
  { smiles: 'CCCCCCCCCCCCCCCCCC(=O)O', name: 'ácido esteárico', soap: 'estearato de sódio', doubleBonds: 0 },
  { smiles: 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', name: 'ácido oleico', soap: 'oleato de sódio', doubleBonds: 1 },
  { smiles: 'CCCCC/C=C\\C/C=C\\CCCCCCCC(=O)O', name: 'ácido linoleico', soap: 'linoleato de sódio', doubleBonds: 2 },
  { smiles: 'CC/C=C\\C/C=C\\C/C=C\\CCCCCCCC(=O)O', name: 'ácido linolênico', soap: 'linolenato de sódio', doubleBonds: 3 },
];

/** A triglyceride and its products drawn with R for the fatty chains, as textbooks do. */
export const GENERIC = {
  triglyceride: '[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O',
  soap: '*C(=O)[O-].[Na+]',
  methylEster: '*C(=O)OC',
  glycerol: 'OCC(O)CO',
};

export const AMINO_ACIDS: Array<Named & { code: string }> = [
  { smiles: 'NCC(=O)O', name: 'glicina', code: 'Gly' },
  { smiles: 'CC(N)C(=O)O', name: 'alanina', code: 'Ala' },
  { smiles: 'OCC(N)C(=O)O', name: 'serina', code: 'Ser' },
  { smiles: 'CC(C)C(N)C(=O)O', name: 'valina', code: 'Val' },
  { smiles: 'CC(C)CC(N)C(=O)O', name: 'leucina', code: 'Leu' },
  { smiles: 'NC(Cc1ccccc1)C(=O)O', name: 'fenilalanina', code: 'Phe' },
  { smiles: 'NC(Cc1ccc(O)cc1)C(=O)O', name: 'tirosina', code: 'Tyr' },
  { smiles: 'NC(CC(=O)O)C(=O)O', name: 'ácido aspártico', code: 'Asp' },
  { smiles: 'NC(CC(N)=O)C(=O)O', name: 'asparagina', code: 'Asn' },
  { smiles: 'NCCCCC(N)C(=O)O', name: 'lisina', code: 'Lys' },
];

/** Open-chain monosaccharides (constitution only, as in simplified exam drawings). */
export const MONOSACCHARIDES: Array<Named & { carbons: number }> = [
  { smiles: 'OCC(O)C=O', name: 'gliceraldeído', carbons: 3 },
  { smiles: 'OCC(=O)CO', name: 'di-hidroxiacetona', carbons: 3 },
  { smiles: 'OCC(O)C(O)C=O', name: 'eritrose', carbons: 4 },
  { smiles: 'OCC(O)C(O)C(O)C=O', name: 'ribose', carbons: 5 },
  { smiles: 'OCC(O)C(O)C(=O)CO', name: 'ribulose', carbons: 5 },
  { smiles: 'OCC(O)C(O)C(O)C(O)C=O', name: 'glicose', carbons: 6 },
  { smiles: 'OCC(O)C(O)C(O)C(=O)CO', name: 'frutose', carbons: 6 },
];

/** Ring forms used to build disaccharides; `anomericO`/`anomericC` lose water, `o4` receives. */
export const SUGAR_RINGS = {
  glucose: { smiles: 'OCC1OC(O)C(O)C(O)C1O', anomericC: 4, anomericO: 5, o4: 11 },
  fructose: { smiles: 'OCC1(O)OC(CO)C(O)C1O', anomericC: 2, anomericO: 3 },
};
