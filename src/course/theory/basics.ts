/** Theory cards for units 1–5: the carbon, chains, hydrocarbons, functions and isomerism. */
import type { TheoryCard } from '../types.ts';

export const BASICS: Record<string, TheoryCard[]> = {
  // ---------------------------------------------------------------------------
  // Unidade 1 — o carbono e suas fórmulas

  tetravalencia: [
    {
      title: 'Sempre quatro ligações',
      body: [
        'O carbono é **tetravalente**: em toda substância orgânica ele faz exatamente **4 ligações**.',
        'Uma ligação **dupla** conta como 2 e uma **tripla** conta como 3. Por isso o carbono pode ter 4 simples, 1 dupla e 2 simples, 2 duplas ou 1 tripla e 1 simples.',
      ],
      molecules: [
        { smiles: 'C', formula: 'structural', label: 'metano: 4 simples' },
        { smiles: 'C=C', formula: 'structural', label: 'eteno: 1 dupla + 2 simples' },
        { smiles: 'C#C', formula: 'structural', label: 'etino: 1 tripla + 1 simples' },
      ],
    },
    {
      title: 'Cada átomo tem sua conta',
      body: [
        'Os vizinhos do carbono também têm um número fixo de ligações: **H** faz 1, **O** faz 2, **N** faz 3, e os halogênios (F, Cl, Br, I) fazem 1.',
        'Na C=O do metanal, o carbono usa 2 ligações com o O e 2 com os hidrogênios: 2 + 1 + 1 = 4.',
      ],
      molecules: [
        { smiles: 'C=O', formula: 'structural', label: 'metanal: C=O conta 2' },
        { smiles: 'CCO', formula: 'structural', label: 'etanol: O faz 2 ligações' },
      ],
    },
    {
      title: 'Bastão: H escondidos',
      body: [
        'Na **fórmula de bastão** (de linhas), cada **ponta** e cada **vértice** é um carbono. Os carbonos não são escritos.',
        'Os hidrogênios ligados ao carbono também ficam **ocultos**: complete cada carbono até 4 ligações com H. Átomos diferentes de C e H (O, N, Cl…) sempre aparecem.',
      ],
      molecules: [
        { smiles: 'CCCC', label: 'butano em bastão: 4 carbonos' },
        { smiles: 'CCCC', formula: 'structural', label: 'o mesmo butano, com tudo escrito' },
      ],
    },
    {
      title: 'Fórmula molecular',
      body: [
        'A **fórmula molecular** conta os átomos: primeiro C, depois H, depois os outros em ordem alfabética.',
        'No propeno, há 3 carbonos. O carbono da ponta da dupla tem 2 H, o do meio tem 1 H e o CH₃ tem 3 H: **C₃H₆**.',
      ],
      molecules: [{ smiles: 'C=CC', label: 'propeno: C₃H₆' }],
      tip: 'A pegadinha mais comum do ENEM é esquecer os H ocultos do bastão ao montar a fórmula molecular.',
    },
  ],

  'tres-formulas': [
    {
      title: 'Estrutural: tudo à mostra',
      body: [
        'Na **fórmula estrutural** todos os átomos e todas as ligações aparecem, inclusive cada C–H.',
        'É a mais fácil de ler e a mais trabalhosa de desenhar.',
      ],
      molecules: [{ smiles: 'CCCO', formula: 'structural', label: 'propan-1-ol, fórmula estrutural' }],
    },
    {
      title: 'Condensada e plana',
      body: [
        'Na **condensada**, os hidrogênios ficam escritos junto do seu carbono: H₃C–CH₂–CH₂–OH. As ligações C–H somem, as ligações entre os carbonos continuam.',
        'O ENEM também usa a **fórmula estrutural plana**: os carbonos da cadeia são escritos com todas as ligações, e os grupos das pontas aparecem condensados (CH₃, OH, COOH).',
      ],
      molecules: [
        { smiles: 'CCCO', formula: 'condensed', label: 'condensada' },
        { smiles: 'CCCO', formula: 'plana', label: 'plana' },
      ],
    },
    {
      title: 'Bastão: só o esqueleto',
      body: [
        'Na **fórmula de bastão**, cada vértice e cada ponta é um carbono, e os H dos carbonos ficam subentendidos.',
        'Heteroátomos e os H ligados a eles continuam escritos: o –OH do propan-1-ol aparece inteiro.',
      ],
      molecules: [{ smiles: 'CCCO', label: 'propan-1-ol em bastão' }],
    },
    {
      title: 'Mesma fórmula, outra molécula',
      body: [
        'Fórmulas diferentes podem desenhar a **mesma** substância. Mas duas estruturas diferentes também podem ter a **mesma fórmula molecular**: são **isômeros**.',
        'Butano e metilpropano são ambos C₄H₁₀, com cadeias diferentes.',
      ],
      molecules: [
        { smiles: 'CCCC', label: 'butano: C₄H₁₀' },
        { smiles: 'CC(C)C', label: 'metilpropano: C₄H₁₀' },
      ],
      tip: 'Para comparar duas estruturas, conte C e H de cada uma: se as contas batem, elas têm a mesma fórmula molecular.',
    },
  ],

  'classes-de-carbono': [
    {
      title: 'Conte os vizinhos carbono',
      body: [
        'A classe de um carbono depende de **quantos outros carbonos** estão ligados a ele.',
        '**Primário**: 1 carbono vizinho. **Secundário**: 2. **Terciário**: 3. **Quaternário**: 4.',
      ],
      molecules: [
        { smiles: 'CC', highlight: [0], label: 'primário: 1 C vizinho' },
        { smiles: 'CCC', highlight: [1], label: 'secundário: 2 C vizinhos' },
        { smiles: 'CC(C)C', highlight: [1], label: 'terciário: 3 C vizinhos' },
        { smiles: 'CC(C)(C)C', highlight: [1], label: 'quaternário: 4 C vizinhos' },
      ],
    },
    {
      title: 'Só carbono entra na conta',
      body: [
        'Hidrogênio, oxigênio, nitrogênio e halogênios **não contam**. No etanol, o carbono ligado ao –OH tem um só carbono vizinho: é primário.',
        'Uma ligação dupla com outro carbono conta como **um vizinho**. E o metano, sem nenhum carbono vizinho, não tem classe.',
      ],
      molecules: [
        { smiles: 'CCO', highlight: [1], label: 'etanol: C primário (o O não conta)' },
        { smiles: 'C=CC', highlight: [1], label: 'propeno: C secundário' },
      ],
    },
    {
      title: 'Classificando uma cadeia',
      body: [
        'Passe por cada carbono e conte seus vizinhos carbono. No **isoctano** (2,2,4-trimetilpentano) há 5 primários, 1 secundário, 1 terciário e 1 quaternário.',
        'Todo CH₃ da ponta é primário. Os carbonos com ramificação costumam ser terciários ou quaternários.',
      ],
      molecules: [{ smiles: 'CC(C)(C)CC(C)C', highlight: [1], label: 'isoctano: o C quaternário destacado' }],
      tip: 'O isoctano, referência da octanagem da gasolina, aparece no ENEM pedindo a contagem de cada classe de carbono.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Unidade 2 — cadeias carbônicas

  'aberta-fechada': [
    {
      title: 'Aberta ou fechada',
      body: [
        'Cadeia **aberta** (acíclica) tem pontas livres. Cadeia **fechada** (cíclica) tem carbonos formando um anel.',
        'Se existe anel, a cadeia conta como fechada. Alguns livros chamam de **mista** a que tem anel e também parte aberta, como o etilbenzeno.',
      ],
      molecules: [
        { smiles: 'CCCCCC', label: 'hexano: aberta' },
        { smiles: 'C1CCCCC1', label: 'cicloexano: fechada' },
      ],
    },
    {
      title: 'Normal ou ramificada',
      body: [
        'Uma cadeia aberta **normal** tem só **duas pontas**: é uma sequência única de carbonos.',
        'A cadeia **ramificada** tem mais de duas pontas. A ramificação sempre nasce num carbono **terciário** ou **quaternário**.',
      ],
      molecules: [
        { smiles: 'CCCCC', label: 'pentano: normal, 2 pontas' },
        { smiles: 'CC(C)CC', highlight: [1], label: '2-metilbutano: ramifica no C terciário' },
      ],
    },
    {
      title: 'Achando a ramificação',
      body: [
        'Conte as pontas do bastão: cada uma é um CH₃. Três ou mais pontas indicam ramificação.',
        'O ponto de ramificação é o carbono ligado a **3 ou 4 outros carbonos**.',
      ],
      molecules: [{ smiles: 'CC(C)(C)CC', highlight: [1], label: '2,2-dimetilbutano: ramifica no C quaternário' }],
      tip: 'Num anel, a cadeia é ramificada quando um grupo de carbono sai dele, como o metil do metilcicloexano.',
    },
  ],

  saturacao: [
    {
      title: 'Saturada ou insaturada',
      body: [
        'Cadeia **saturada** tem só ligações **simples** entre carbonos.',
        'Cadeia **insaturada** tem pelo menos uma ligação **dupla ou tripla entre dois carbonos**. Essa ligação é a **insaturação** e envolve os dois carbonos que ela une.',
      ],
      molecules: [
        { smiles: 'CCCC', label: 'butano: saturada' },
        { smiles: 'C=CCC', highlight: [0, 1], label: 'but-1-eno: dupla C=C' },
        { smiles: 'C#CC', highlight: [0, 1], label: 'propino: tripla C≡C' },
      ],
    },
    {
      title: 'Só vale entre carbonos',
      body: [
        'A dupla **C=O** de cetonas, aldeídos e ácidos não é entre dois carbonos, então **não** torna a cadeia insaturada. A propanona tem cadeia saturada.',
        'Já o anel benzênico tem duplas alternadas entre carbonos: sua cadeia é insaturada.',
      ],
      molecules: [
        { smiles: 'CC(C)=O', highlight: [1, 3], label: 'propanona: C=O, cadeia saturada' },
        { smiles: 'c1ccccc1', label: 'benzeno: insaturada' },
      ],
      tip: 'Pegadinha clássica: ver uma dupla e marcar "insaturada" sem conferir se ela liga dois carbonos.',
    },
  ],

  heteroatomos: [
    {
      title: 'Heteroátomo entre carbonos',
      body: [
        '**Heteroátomo** é um átomo diferente de carbono (O, N, S…) que fica **entre dois carbonos** da cadeia.',
        'Se existe heteroátomo, a cadeia é **heterogênea**. Se entre os carbonos só há carbonos, ela é **homogênea**.',
      ],
      molecules: [
        { smiles: 'CCOCC', highlight: [2], label: 'etoxietano: O entre C, heterogênea' },
        { smiles: 'CCNCC', highlight: [2], label: 'dietilamina: N entre C, heterogênea' },
      ],
    },
    {
      title: 'Na ponta não conta',
      body: [
        'O oxigênio do –OH e o da C=O ficam **na ponta**, presos a um só carbono: não são heteroátomos da cadeia. O etanol tem cadeia homogênea.',
        'No anel também vale: o O do oxolano está entre dois carbonos, então a cadeia é heterogênea.',
      ],
      molecules: [
        { smiles: 'CCO', highlight: [2], label: 'etanol: O na ponta, homogênea' },
        { smiles: 'C1CCOC1', highlight: [3], label: 'oxolano: O no anel, heterogênea' },
      ],
    },
    {
      title: 'O caso dos ésteres',
      body: [
        'No éster, o O da ponte –O– fica entre dois carbonos e torna a cadeia heterogênea. O O da C=O, na ponta, não conta.',
      ],
      molecules: [{ smiles: 'CCOC(C)=O', highlight: [2], label: 'etanoato de etila: o O da ponte' }],
      tip: 'Éteres, ésteres e aminas com N entre carbonos dão cadeia heterogênea; álcoois, cetonas e ácidos, homogênea.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Unidade 3 — hidrocarbonetos

  'classes-hc': [
    {
      title: 'Só carbono e hidrogênio',
      body: [
        '**Hidrocarbonetos** têm apenas C e H. Em cadeia aberta, a ligação dá a classe: **alcano** (só simples), **alceno** (uma dupla), **alcino** (uma tripla) e **alcadieno** (duas duplas).',
      ],
      molecules: [
        { smiles: 'CCC', label: 'propano: alcano' },
        { smiles: 'C=CC', label: 'propeno: alceno' },
        { smiles: 'C#CC', label: 'propino: alcino' },
        { smiles: 'C=CC=C', label: 'buta-1,3-dieno: alcadieno' },
      ],
    },
    {
      title: 'Anéis e aromáticos',
      body: [
        'Em cadeia fechada: **cicloalcano** (anel só com simples) e **cicloalceno** (anel com uma dupla).',
        'Os **aromáticos** têm anel benzênico: seis carbonos com duplas alternadas.',
      ],
      molecules: [
        { smiles: 'C1CCCCC1', label: 'cicloexano: cicloalcano' },
        { smiles: 'C1=CCCCC1', label: 'cicloexeno: cicloalceno' },
        { smiles: 'Cc1ccccc1', label: 'tolueno: aromático' },
      ],
    },
    {
      title: 'Fórmulas gerais',
      body: [
        'Alcano: **CₙH₂ₙ₊₂**. Alceno e cicloalcano: **CₙH₂ₙ**. Alcino e alcadieno: **CₙH₂ₙ₋₂**.',
        'Cada dupla ou anel tira 2 H da conta do alcano; cada tripla tira 4.',
      ],
      molecules: [
        { smiles: 'C=CCC', label: 'but-1-eno: C₄H₈' },
        { smiles: 'C1CCC1', label: 'ciclobutano: também C₄H₈' },
      ],
      tip: 'A fórmula CₙH₂ₙ sozinha não decide: pode ser alceno ou cicloalcano. Olhe a estrutura.',
    },
  ],

  'nomenclatura-hc': [
    {
      title: 'Prefixo, infixo, sufixo',
      body: [
        'O **prefixo** conta os carbonos: 1 met, 2 et, 3 prop, 4 but, 5 pent, 6 hex, 7 hept, 8 oct.',
        'O **infixo** diz a ligação: -an- (só simples), -en- (dupla), -in- (tripla). O **sufixo** -o indica hidrocarboneto. Anel ganha o prefixo **ciclo-**.',
      ],
      molecules: [
        { smiles: 'CCCCC', label: 'pent + an + o = pentano' },
        { smiles: 'C#CC', label: 'prop + in + o = propino' },
        { smiles: 'C1CCCCC1', label: 'ciclo + hex + an + o = cicloexano' },
      ],
    },
    {
      title: 'A posição da dupla',
      body: [
        'Numere a cadeia pela ponta **mais próxima** da dupla ou tripla e escreva a posição antes do infixo, com o menor número possível.',
        'Se a insaturação está entre C1 e C2, a posição é 1: but-1-eno. Entre C2 e C3: but-2-eno.',
      ],
      molecules: [
        { smiles: 'C=CCC', highlight: [0, 1], label: 'but-1-eno' },
        { smiles: 'CC=CC', highlight: [1, 2], label: 'but-2-eno' },
      ],
    },
    {
      title: 'Ramificações',
      body: [
        'Ache a **cadeia principal**, a mais longa. Numere pela ponta mais perto da ramificação e cite cada grupo com a posição: **metil** (–CH₃), **etil** (–CH₂–CH₃).',
        'Grupos repetidos ganham di-, tri-: 2,2-dimetilbutano. Se houver insaturação, ela manda na numeração.',
      ],
      molecules: [
        { smiles: 'CC(C)CC', highlight: [2], label: '2-metilbutano' },
        { smiles: 'CC(C)(C)CC', highlight: [1], label: '2,2-dimetilbutano: dois metil no C2' },
      ],
      tip: 'Erro comum: numerar pela ponta errada. No metilpropano o número nem aparece, porque o metil só cabe no C2.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Unidade 4 — funções orgânicas

  oxigenadas: [
    {
      title: 'Com hidroxila (–OH)',
      body: [
        '**Álcool**: –OH em carbono saturado. **Fenol**: –OH preso direto ao anel aromático. **Enol**: –OH em carbono de ligação dupla.',
      ],
      molecules: [
        { smiles: 'CCO', highlight: [2], label: 'etanol: álcool' },
        { smiles: 'Oc1ccccc1', highlight: [0], label: 'fenol' },
        { smiles: 'C=CO', highlight: [2], label: 'etenol: enol' },
      ],
    },
    {
      title: 'Com carbonila (C=O)',
      body: [
        '**Aldeído**: carbonila na **ponta** da cadeia, com um H no carbono (–CHO).',
        '**Cetona**: carbonila **entre dois carbonos** (>C=O).',
      ],
      molecules: [
        { smiles: 'CC=O', highlight: [1, 2], label: 'etanal: aldeído' },
        { smiles: 'CC(C)=O', highlight: [1, 3], label: 'propanona: cetona' },
      ],
    },
    {
      title: 'Ácido, éster e éter',
      body: [
        '**Ácido carboxílico**: carbonila e hidroxila no mesmo carbono, a carboxila (–COOH).',
        '**Éster**: carbonila ligada a um O que segue para outro carbono (–COO–). **Éter**: O entre dois carbonos, sem carbonila (–O–).',
      ],
      molecules: [
        { smiles: 'CC(=O)O', highlight: [1, 2, 3], label: 'ácido etanoico' },
        { smiles: 'COC(C)=O', highlight: [1, 2, 4], label: 'etanoato de metila: éster' },
        { smiles: 'COC', highlight: [1], label: 'metoximetano: éter' },
      ],
      tip: 'Éster × éter: o éster tem a C=O vizinha ao –O–; o éter não tem carbonila nenhuma.',
    },
  ],

  nitrogenadas: [
    {
      title: 'Aminas e amidas',
      body: [
        '**Amina**: nitrogênio ligado só a carbonos e hidrogênios, como se fosse a amônia (NH₃) com H trocados por cadeias.',
        '**Amida**: a carbonila está ligada **diretamente** ao nitrogênio (–CON<).',
      ],
      molecules: [
        { smiles: 'CN', highlight: [1], label: 'metanamina: amina' },
        { smiles: 'Nc1ccccc1', highlight: [0], label: 'fenilamina: amina' },
        { smiles: 'CC(N)=O', highlight: [1, 2, 3], label: 'etanamida: amida' },
      ],
    },
    {
      title: 'Nitrilas e nitrocompostos',
      body: [
        '**Nitrila**: carbono ligado ao nitrogênio por ligação tripla (–C≡N).',
        '**Nitrocomposto**: o grupo –NO₂, um nitrogênio ligado a dois oxigênios, preso à cadeia.',
      ],
      molecules: [
        { smiles: 'CC#N', highlight: [1, 2], label: 'etanonitrila: nitrila' },
        { smiles: '[O-][N+](=O)c1ccccc1', highlight: [0, 1, 2], label: 'nitrobenzeno: nitrocomposto' },
      ],
    },
    {
      title: 'Haletos orgânicos',
      body: [
        '**Haleto orgânico**: um halogênio (F, Cl, Br ou I) ligado ao carbono, o grupo –X.',
      ],
      molecules: [
        { smiles: 'CCl', highlight: [1], label: 'clorometano' },
        { smiles: 'ClC(Cl)Cl', highlight: [0, 2, 3], label: 'triclorometano (clorofórmio)' },
        { smiles: 'Clc1ccccc1', highlight: [0], label: 'clorobenzeno' },
      ],
      tip: 'Amina × amida: se o N está grudado no carbono da C=O, é amida.',
    },
  ],

  cotidiano: [
    {
      title: 'Várias funções juntas',
      body: [
        'Moléculas reais, como fármacos e aromas, costumam ter **mais de um grupo funcional**. Procure um grupo por vez.',
        'Na aspirina há um **éster** e um **ácido carboxílico** no mesmo anel.',
      ],
      molecules: [
        { smiles: 'CC(=O)Oc1ccccc1C(=O)O', highlight: [1, 2, 3], label: 'aspirina: o éster' },
        { smiles: 'CC(=O)Oc1ccccc1C(=O)O', highlight: [10, 11, 12], label: 'aspirina: o ácido' },
      ],
    },
    {
      title: 'Um roteiro para achar',
      body: [
        '**–OH**: no anel é fenol; em carbono saturado, álcool. **C=O**: com OH no mesmo C é ácido; com –O–C, éster; com N, amida; entre carbonos, cetona; na ponta com H, aldeído.',
        '**O entre carbonos** sem C=O é éter. **N** sem C=O vizinha é amina.',
      ],
      molecules: [{ smiles: 'COc1cc(C=O)ccc1O', caption: 'Vanilina', label: 'aldeído, fenol e éter' }],
    },
    {
      title: 'Clássicos do ENEM',
      body: [
        'O **paracetamol** tem amida e fenol. A **capsaicina**, da pimenta, tem amida, fenol e éter. A **adrenalina** tem amina, álcool e fenol.',
      ],
      molecules: [
        { smiles: 'CC(=O)Nc1ccc(O)cc1', caption: 'Paracetamol', label: 'amida e fenol' },
        { smiles: 'CNC[C@H](O)c1ccc(O)c(O)c1', caption: 'Adrenalina', label: 'amina, álcool e fenol' },
      ],
      tip: 'O ENEM dá a estrutura de um fármaco ou aroma e pede as funções: marque cada grupo antes de ler as alternativas.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Unidade 5 — isomeria

  geometrica: [
    {
      title: 'A dupla não gira',
      body: [
        'A ligação dupla **não permite rotação**. Por isso, os grupos presos a ela ficam fixos de um lado ou do outro.',
        '**Cis**: os grupos principais do mesmo lado da dupla. **Trans**: em lados opostos.',
      ],
      molecules: [
        { smiles: 'C/C=C\\C', label: 'cis-but-2-eno: mesmo lado' },
        { smiles: 'C/C=C/C', label: 'trans-but-2-eno: lados opostos' },
      ],
    },
    {
      title: 'Quando existe cis-trans',
      body: [
        'Só há isomeria geométrica se **cada carbono da dupla** tiver **dois ligantes diferentes** entre si.',
        'Se um dos carbonos tiver dois ligantes iguais, como dois H ou dois CH₃, não existem formas cis e trans.',
      ],
      molecules: [
        { smiles: 'C=CC', highlight: [0], label: 'propeno: C com dois H, não tem' },
        { smiles: 'CC(C)=CC', highlight: [1], label: '2-metilbut-2-eno: dois CH₃, não tem' },
        { smiles: 'ClC=CCl', label: '1,2-dicloroeteno: tem cis e trans' },
      ],
    },
    {
      title: 'Cis e trans no dia a dia',
      body: [
        'Isômeros cis e trans são substâncias diferentes, com propriedades diferentes. O ácido maleico (cis) e o fumárico (trans) têm pontos de fusão bem distintos.',
        'As **gorduras trans**, ligadas a doenças do coração, têm duplas na forma trans.',
      ],
      molecules: [
        { smiles: 'OC(=O)/C=C\\C(=O)O', label: 'ácido maleico: cis' },
        { smiles: 'OC(=O)/C=C/C(=O)O', label: 'ácido fumárico: trans' },
      ],
      tip: 'Olhe cada carbono da dupla separadamente: os dois precisam ter ligantes diferentes.',
    },
  ],

  quiral: [
    {
      title: 'Quatro ligantes diferentes',
      body: [
        '**Carbono quiral** (ou assimétrico) está ligado a **quatro grupos diferentes** entre si.',
        'Por isso ele só faz ligações simples e não pode ter dois H.',
      ],
      molecules: [
        { smiles: 'CC(O)C(=O)O', highlight: [1], label: 'ácido lático: H, CH₃, OH e COOH' },
        { smiles: 'CCC(C)O', highlight: [2], label: 'butan-2-ol: H, CH₃, C₂H₅ e OH' },
      ],
    },
    {
      title: 'A imagem no espelho',
      body: [
        'Uma molécula com carbono quiral e sua imagem no espelho **não se sobrepõem**, como as mãos direita e esquerda. Elas são **enantiômeros**.',
        'Enantiômeros desviam a luz polarizada em sentidos opostos: têm **atividade óptica**.',
      ],
      molecules: [
        { smiles: 'C[C@H](O)C(=O)O', label: 'ácido lático' },
        { smiles: 'C[C@@H](O)C(=O)O', label: 'sua imagem no espelho' },
      ],
    },
    {
      title: 'Quando não é quiral',
      body: [
        'Compare os grupos **inteiros**, não só o primeiro átomo. No propan-2-ol, o carbono do –OH tem dois CH₃: não é quiral.',
        'No 3-metilpentano, o carbono do meio tem dois grupos etil iguais. Carbono de dupla ou CH₂ também nunca é quiral.',
      ],
      molecules: [
        { smiles: 'CC(C)O', highlight: [1], label: 'propan-2-ol: dois CH₃' },
        { smiles: 'CCC(C)CC', highlight: [2], label: '3-metilpentano: dois etil' },
      ],
      tip: 'Com n carbonos quirais diferentes, a molécula pode ter até 2ⁿ isômeros ópticos.',
    },
  ],
};
