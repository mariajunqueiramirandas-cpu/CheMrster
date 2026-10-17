/** Molecules that show up again and again in ENEM questions, with their SMILES. */

export interface MoleculeEntry {
  id: string;
  name: string;
  smiles: string;
  /** Why it matters for the exam, in one line. */
  note?: string;
  tags: string[];
}

export const MOLECULES: MoleculeEntry[] = [
  // Hidrocarbonetos
  { id: 'metano', name: 'Metano', smiles: 'C', tags: ['hidrocarboneto', 'alcano'], note: 'Gás natural e biogás.' },
  { id: 'propano', name: 'Propano', smiles: 'CCC', tags: ['hidrocarboneto', 'alcano'], note: 'Componente do GLP.' },
  { id: 'butano', name: 'Butano', smiles: 'CCCC', tags: ['hidrocarboneto', 'alcano'], note: 'GLP, gás de cozinha.' },
  { id: 'isobutano', name: 'Metilpropano', smiles: 'CC(C)C', tags: ['hidrocarboneto', 'alcano', 'isomeria'] },
  { id: 'isooctano', name: 'Isoctano', smiles: 'CC(C)CC(C)(C)C', tags: ['hidrocarboneto', 'alcano'], note: 'Referência da octanagem da gasolina.' },
  { id: 'eteno', name: 'Eteno', smiles: 'C=C', tags: ['hidrocarboneto', 'alceno'], note: 'Hormônio de amadurecimento de frutas.' },
  { id: 'propeno', name: 'Propeno', smiles: 'C=CC', tags: ['hidrocarboneto', 'alceno'] },
  { id: 'trans-but-2-eno', name: 'trans-But-2-eno', smiles: 'C/C=C/C', tags: ['hidrocarboneto', 'alceno', 'isomeria'] },
  { id: 'cis-but-2-eno', name: 'cis-But-2-eno', smiles: 'C/C=C\\C', tags: ['hidrocarboneto', 'alceno', 'isomeria'] },
  { id: 'etino', name: 'Etino (acetileno)', smiles: 'C#C', tags: ['hidrocarboneto', 'alcino'], note: 'Maçarico oxiacetilênico.' },
  { id: 'but-2-ino', name: 'But-2-ino', smiles: 'CC#CC', tags: ['hidrocarboneto', 'alcino'] },
  { id: 'cicloexano', name: 'Cicloexano', smiles: 'C1CCCCC1', tags: ['hidrocarboneto', 'ciclano'] },
  { id: 'ciclopentano', name: 'Ciclopentano', smiles: 'C1CCCC1', tags: ['hidrocarboneto', 'ciclano'] },
  { id: 'ciclopropano', name: 'Ciclopropano', smiles: 'C1CC1', tags: ['hidrocarboneto', 'ciclano'] },
  { id: 'benzeno', name: 'Benzeno', smiles: 'c1ccccc1', tags: ['hidrocarboneto', 'aromático'] },
  { id: 'tolueno', name: 'Tolueno', smiles: 'Cc1ccccc1', tags: ['hidrocarboneto', 'aromático'] },
  { id: 'naftaleno', name: 'Naftaleno', smiles: 'c1ccc2ccccc2c1', tags: ['hidrocarboneto', 'aromático'], note: 'Naftalina.' },
  { id: 'antraceno', name: 'Antraceno', smiles: 'c1ccc2cc3ccccc3cc2c1', tags: ['hidrocarboneto', 'aromático'] },
  { id: 'fenantreno', name: 'Fenantreno', smiles: 'c1ccc2c(c1)ccc1ccccc12', tags: ['hidrocarboneto', 'aromático'] },
  { id: 'benzopireno', name: 'Benzo[a]pireno', smiles: 'c1ccc2c(c1)cc1ccc3cccc4ccc2c1c34', tags: ['hidrocarboneto', 'aromático'], note: 'Cancerígeno da fumaça do cigarro e de churrascos.' },

  // Funções oxigenadas
  { id: 'metanol', name: 'Metanol', smiles: 'CO', tags: ['álcool'] },
  { id: 'etanol', name: 'Etanol', smiles: 'CCO', tags: ['álcool'], note: 'Combustível e bebidas.' },
  { id: 'glicerol', name: 'Glicerol', smiles: 'OCC(O)CO', tags: ['álcool'], note: 'Subproduto do biodiesel.' },
  { id: 'fenol', name: 'Fenol', smiles: 'Oc1ccccc1', tags: ['fenol'] },
  { id: 'etanal', name: 'Etanal', smiles: 'CC=O', tags: ['aldeído'], note: 'Ressaca: oxidação do etanol.' },
  { id: 'formol', name: 'Metanal (formol)', smiles: 'C=O', tags: ['aldeído'] },
  { id: 'acetona', name: 'Propanona (acetona)', smiles: 'CC(C)=O', tags: ['cetona'] },
  { id: 'acido-acetico', name: 'Ácido etanoico (acético)', smiles: 'CC(=O)O', tags: ['ácido carboxílico'], note: 'Vinagre.' },
  { id: 'acido-benzoico', name: 'Ácido benzoico', smiles: 'OC(=O)c1ccccc1', tags: ['ácido carboxílico', 'aromático'] },
  { id: 'eter-dietilico', name: 'Etoxietano', smiles: 'CCOCC', tags: ['éter'] },
  { id: 'acetato-de-etila', name: 'Etanoato de etila', smiles: 'CCOC(C)=O', tags: ['éster'], note: 'Removedor de esmalte.' },
  { id: 'acido-lactico', name: 'Ácido lático', smiles: 'CC(O)C(=O)O', tags: ['ácido carboxílico', 'álcool', 'isomeria'] },
  { id: 'acido-citrico', name: 'Ácido cítrico', smiles: 'OC(=O)CC(O)(CC(=O)O)C(=O)O', tags: ['ácido carboxílico'] },

  // Funções nitrogenadas
  { id: 'metilamina', name: 'Metanamina', smiles: 'CN', tags: ['amina'] },
  { id: 'anilina', name: 'Fenilamina (anilina)', smiles: 'Nc1ccccc1', tags: ['amina', 'aromático'] },
  { id: 'ureia', name: 'Ureia', smiles: 'NC(N)=O', tags: ['amida'], note: 'Síntese de Wöhler (1828).' },
  { id: 'acetamida', name: 'Etanamida', smiles: 'CC(N)=O', tags: ['amida'] },
  { id: 'nitrobenzeno', name: 'Nitrobenzeno', smiles: '[O-][N+](=O)c1ccccc1', tags: ['nitrocomposto', 'aromático'] },
  { id: 'tnt', name: 'TNT', smiles: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]', tags: ['nitrocomposto', 'aromático'] },
  { id: 'piridina', name: 'Piridina', smiles: 'c1ccncc1', tags: ['heterocíclico', 'aromático'] },
  { id: 'pirrol', name: 'Pirrol', smiles: 'c1cc[nH]c1', tags: ['heterocíclico', 'aromático'] },
  { id: 'furano', name: 'Furano', smiles: 'c1ccoc1', tags: ['heterocíclico', 'aromático'] },
  { id: 'acetonitrila', name: 'Etanonitrila', smiles: 'CC#N', tags: ['nitrila'] },

  // Fármacos, alimentos e cotidiano
  { id: 'aspirina', name: 'Ácido acetilsalicílico', smiles: 'CC(=O)Oc1ccccc1C(=O)O', tags: ['fármaco', 'éster', 'ácido carboxílico'], note: 'Aspirina.' },
  { id: 'paracetamol', name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', tags: ['fármaco', 'amida', 'fenol'] },
  { id: 'ibuprofeno', name: 'Ibuprofeno', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', tags: ['fármaco', 'ácido carboxílico'] },
  { id: 'cafeina', name: 'Cafeína', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', tags: ['alcaloide', 'amida', 'amina'] },
  { id: 'nicotina', name: 'Nicotina', smiles: 'CN1CCC[C@H]1c1cccnc1', tags: ['alcaloide', 'amina', 'isomeria'] },
  { id: 'vanilina', name: 'Vanilina', smiles: 'COc1cc(C=O)ccc1O', tags: ['aldeído', 'éter', 'fenol'], note: 'Aroma de baunilha.' },
  { id: 'eugenol', name: 'Eugenol', smiles: 'COc1cc(CC=C)ccc1O', tags: ['éter', 'fenol'], note: 'Óleo de cravo.' },
  { id: 'capsaicina', name: 'Capsaicina', smiles: 'COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O', tags: ['amida', 'fenol', 'éter'], note: 'Ardência da pimenta.' },
  { id: 'limoneno', name: 'Limoneno', smiles: 'CC1=CCC(CC1)C(=C)C', tags: ['hidrocarboneto', 'terpeno'], note: 'Aroma de laranja e limão.' },
  { id: 'carvona', name: 'Carvona', smiles: 'CC1=CC[C@@H](CC1=O)C(=C)C', tags: ['cetona', 'terpeno', 'isomeria'] },
  { id: 'mentol', name: 'Mentol', smiles: 'CC(C)[C@@H]1CC[C@@H](C)C[C@H]1O', tags: ['álcool', 'terpeno', 'isomeria'] },
  { id: 'adrenalina', name: 'Adrenalina', smiles: 'CNC[C@H](O)c1ccc(O)c(O)c1', tags: ['amina', 'fenol', 'álcool', 'isomeria'] },
  { id: 'dopamina', name: 'Dopamina', smiles: 'NCCc1ccc(O)c(O)c1', tags: ['amina', 'fenol'] },
  { id: 'serotonina', name: 'Serotonina', smiles: 'NCCc1c[nH]c2ccc(O)cc12', tags: ['amina', 'fenol'] },
  { id: 'testosterona', name: 'Testosterona', smiles: 'C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O', tags: ['hormônio', 'cetona', 'álcool'] },
  { id: 'colesterol', name: 'Colesterol', smiles: 'C[C@H](CCCC(C)C)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CC=C4[C@@]3(CC[C@@H](C4)O)C)C', tags: ['esteroide', 'álcool'] },
  { id: 'acido-oleico', name: 'Ácido oleico', smiles: 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', tags: ['ácido graxo', 'isomeria'], note: 'Gordura cis do azeite.' },
  { id: 'acido-elaidico', name: 'Ácido elaídico', smiles: 'CCCCCCCC/C=C/CCCCCCCC(=O)O', tags: ['ácido graxo', 'isomeria'], note: 'Gordura trans.' },
  { id: 'glicose', name: 'Glicose', smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', tags: ['carboidrato'] },
  { id: 'alanina', name: 'L-Alanina', smiles: 'C[C@H](N)C(=O)O', tags: ['aminoácido', 'isomeria'] },
  { id: 'glicina', name: 'Glicina', smiles: 'NCC(=O)O', tags: ['aminoácido'] },
  { id: 'acetato-de-sodio', name: 'Acetato de sódio', smiles: 'CC(=O)[O-].[Na+]', tags: ['sal orgânico'] },
  { id: 'sabao', name: 'Estearato de sódio (sabão)', smiles: 'CCCCCCCCCCCCCCCCCC(=O)[O-].[Na+]', tags: ['sal orgânico'] },
  { id: 'ddt', name: 'DDT', smiles: 'ClC(Cl)(Cl)C(c1ccc(Cl)cc1)c1ccc(Cl)cc1', tags: ['haleto orgânico'] },
  { id: 'bisfenol-a', name: 'Bisfenol A', smiles: 'CC(C)(c1ccc(O)cc1)c1ccc(O)cc1', tags: ['fenol'] },
  { id: 'cloroformio', name: 'Triclorometano', smiles: 'ClC(Cl)Cl', tags: ['haleto orgânico'] },
  { id: 'cocaina', name: 'Cocaína', smiles: 'CN1[C@H]2CC[C@@H]1[C@H]([C@H](C2)OC(=O)c1ccccc1)C(=O)OC', tags: ['alcaloide', 'éster', 'amina'] },
  { id: 'canfora', name: 'Cânfora', smiles: 'CC1(C)C2CCC1(C)C(=O)C2', tags: ['cetona', 'terpeno'] },
  { id: 'betacaroteno', name: 'β-Caroteno', smiles: 'CC1=C(C(C)(C)CCC1)/C=C/C(C)=C/C=C/C(C)=C/C=C/C=C(C)/C=C/C=C(C)/C=C/C1=C(C)CCCC1(C)C', tags: ['hidrocarboneto', 'terpeno'], note: 'Pigmento da cenoura.' },
  { id: 'estireno', name: 'Estireno', smiles: 'C=Cc1ccccc1', tags: ['hidrocarboneto', 'polímeros'] },
  { id: 'cloreto-de-vinila', name: 'Cloroeteno', smiles: 'C=CCl', tags: ['haleto orgânico', 'polímeros'], note: 'Monômero do PVC.' },
];

export const MOLECULE_BY_ID: Record<string, MoleculeEntry> = Object.fromEntries(MOLECULES.map((m) => [m.id, m]));
