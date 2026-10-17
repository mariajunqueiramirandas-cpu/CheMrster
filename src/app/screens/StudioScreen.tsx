import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { chiralCarbons, classifyChain, functionalGroups, molarMass } from '../../chem/analysis.ts';
import { MOLECULES } from '../../content/molecules.ts';
import { subscript } from '../../course/kit.ts';
import { type Annotation, type FormulaKind, STYLES, moleculeFromSmiles, renderSVG } from '../../nanquim/index.ts';
import { DownloadIcon, PrintIcon } from '../components/Icons.tsx';
import { type MoleculeLook, MoleculeView } from '../components/MoleculeView.tsx';
import { ReactionLab } from '../components/ReactionLab.tsx';
import { href } from '../router.ts';

const FORMULAS: Array<{ id: FormulaKind; label: string }> = [
  { id: 'skeletal', label: 'Bastão' },
  { id: 'condensed', label: 'Condensada' },
  { id: 'plana', label: 'Plana' },
  { id: 'structural', label: 'Completa' },
];

const LOOKS: Array<{ id: MoleculeLook; label: string }> = [
  { id: 'enem', label: 'ENEM' },
  { id: 'textbook', label: 'Livro' },
  { id: 'acs', label: 'Revista' },
];

/** Short names the booklets write next to marked groups (2024 Q112: "nitro", "éter"). */
const SHORT_NAME: Partial<Record<string, string>> = {
  nitrocomposto: 'nitro',
  'haleto orgânico': 'haleto',
  'sal orgânico': 'carboxilato',
};

/** ENEM-style group marks: a dashed outline and the group's name, as in 2024 Q112. */
function groupAnnotations(smiles: string): Annotation[] {
  const mol = moleculeFromSmiles(smiles);
  return functionalGroups(mol).map((g) => ({ atoms: g.atoms, label: SHORT_NAME[g.id] ?? g.id }));
}

const DEFAULT = MOLECULES.find((m) => m.id === 'capsaicina')!.smiles;

export function StudioScreen({ initialSmiles }: { initialSmiles?: string }) {
  const [text, setText] = useState(initialSmiles ?? DEFAULT);
  const [formula, setFormula] = useState<FormulaKind>('skeletal');
  const [circles, setCircles] = useState(false);
  const [colored, setColored] = useState(false);
  const [look, setLook] = useState<MoleculeLook>('enem');
  const [marked, setMarked] = useState(false);
  const [query, setQuery] = useState('');
  const smiles = useDeferredValue(text.trim());

  useEffect(() => {
    if (initialSmiles) setText(initialSmiles);
  }, [initialSmiles]);

  const parsed = useMemo(() => {
    if (!smiles) return { error: 'Digite um SMILES para desenhar.' } as const;
    try {
      return { mol: moleculeFromSmiles(smiles) } as const;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) } as const;
    }
  }, [smiles]);

  useEffect(() => {
    if (!('mol' in parsed)) return;
    history.replaceState(null, '', href({ name: 'studio', smiles }));
  }, [parsed, smiles]);

  const entry = MOLECULES.find((m) => m.smiles === smiles);
  const annotations = useMemo(() => (marked && 'mol' in parsed ? groupAnnotations(smiles) : undefined), [marked, parsed, smiles]);
  const svgFile = () => {
    const svg = renderSVG(smiles, {
      formula,
      aromaticCircles: circles,
      conventions: look === 'enem' ? 'enem' : 'textbook',
      style: { ...STYLES[look], ink: '#000000', palette: colored ? 'color' : 'mono' },
      annotations,
      caption: entry?.name,
      title: entry?.name,
      scale: look === 'textbook' ? 1 : 2,
    });
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry?.id ?? 'estrutura'}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const gallery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOLECULES.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)) || m.note?.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="studio">
      <header className="studio-head">
        <h1>Estruturas</h1>
        <p>Escreva um SMILES e veja a molécula desenhada como num livro impresso.</p>
      </header>

      <label className="field">
        <span className="field-label">SMILES</span>
        <input
          className="field-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={'error' in parsed}
          aria-describedby="smiles-status"
        />
      </label>

      <figure className="paper paper--studio">
        {'mol' in parsed ? (
          <MoleculeView
            key={`${smiles}-${formula}-${look}`}
            smiles={smiles}
            formula={formula}
            size={look === 'acs' ? 30 : 42}
            look={look}
            aromaticCircles={circles}
            colored={colored}
            annotations={annotations}
            caption={entry?.name}
            animate
            title={entry?.name}
          />
        ) : (
          <p className="paper-empty" id="smiles-status" role="alert">
            {parsed.error}
          </p>
        )}
      </figure>

      <div className="studio-controls">
        <div className="segmented segmented--four" role="radiogroup" aria-label="Tipo de fórmula">
          {FORMULAS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={formula === f.id}
              className={formula === f.id ? 'is-on' : ''}
              onClick={() => setFormula(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="segmented segmented--looks" role="radiogroup" aria-label="Estilo do desenho">
          {LOOKS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={look === l.id}
              className={look === l.id ? 'is-on' : ''}
              onClick={() => setLook(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="toggles">
          <Toggle checked={marked} onChange={setMarked} label="Marcar funções orgânicas" />
          <Toggle checked={circles} onChange={setCircles} label="Anel aromático com círculo" />
          <Toggle checked={colored} onChange={setColored} label="Heteroátomos coloridos" />
        </div>
        <div className="studio-actions">
          <button type="button" className="btn" onClick={svgFile} disabled={!('mol' in parsed)}>
            <DownloadIcon /> Baixar SVG
          </button>
          <button type="button" className="btn" onClick={() => window.print()} disabled={!('mol' in parsed)}>
            <PrintIcon /> Imprimir
          </button>
        </div>
      </div>

      {'mol' in parsed && <Analysis smiles={smiles} />}

      {'mol' in parsed && (
        <ReactionLab
          key={smiles}
          smiles={smiles}
          onOpen={(product) => {
            setText(product);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <section className="gallery" aria-labelledby="gallery-title">
        <div className="gallery-head">
          <h2 id="gallery-title">Moléculas que caem no ENEM</h2>
          <input
            className="field-input field-input--search"
            type="search"
            placeholder="Buscar por nome ou função"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar molécula"
          />
        </div>
        {gallery.length === 0 ? (
          <p className="gallery-empty">Nenhuma molécula com esse nome ou função. Tente "éster" ou "fármaco".</p>
        ) : (
          <ul className="gallery-grid">
            {gallery.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`gallery-item paper${m.smiles === smiles ? ' is-current' : ''}`}
                  onClick={() => {
                    setText(m.smiles);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span className="gallery-thumb">
                    <MoleculeView smiles={m.smiles} size={22} />
                  </span>
                  <span className="gallery-name">{m.name}</span>
                  {m.note && <span className="gallery-note">{m.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

function Analysis({ smiles }: { smiles: string }) {
  const info = useMemo(() => {
    const mol = moleculeFromSmiles(smiles);
    const groups = [...new Set(functionalGroups(mol).map((g) => g.id))];
    const chain = classifyChain(mol);
    const mass = molarMass(mol);
    const chain1 = [
      chain.fechada ? (chain.aromatica ? 'fechada, aromática' : 'fechada') : 'aberta',
      chain.ramificada ? 'ramificada' : 'normal',
      chain.insaturada ? 'insaturada' : 'saturada',
      chain.heterogenea ? 'heterogênea' : 'homogênea',
    ];
    return { formula: subscript(mol.formula()), groups, chain: chain1, chiral: chiralCarbons(mol).length, mass };
  }, [smiles]);
  return (
    <dl className="analysis">
      <div>
        <dt>Fórmula molecular</dt>
        <dd className="analysis-formula">{info.formula}</dd>
      </div>
      {info.mass !== undefined && (
        <div>
          <dt>Massa molar</dt>
          <dd>{info.mass.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g/mol</dd>
        </div>
      )}
      <div className="analysis-wide">
        <dt>Cadeia</dt>
        <dd>{info.chain.join(', ')}</dd>
      </div>
      <div>
        <dt>Carbonos quirais</dt>
        <dd>{info.chiral}</dd>
      </div>
      <div className="analysis-wide">
        <dt>Funções orgânicas</dt>
        <dd>
          {info.groups.length ? (
            <ul className="chips">
              {info.groups.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : (
            'Nenhuma: só carbono e hidrogênio.'
          )}
        </dd>
      </div>
    </dl>
  );
}
