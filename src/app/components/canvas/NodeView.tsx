/** One card on the concept map, by kind: a note, a structure, theory from the course, a tutor answer or a question. */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { LESSON_BY_ID } from '../../../course/course.ts';
import { THEORY } from '../../../course/theory/index.ts';
import type { MapNode } from '../../../study/canvas.ts';
import { moleculeFromSmiles } from '../../../nanquim/index.ts';
import { MoleculeView } from '../MoleculeView.tsx';
import { SpecView } from '../SchemeView.tsx';
import { Rich } from '../TheoryCardView.tsx';
import { Markup } from '../tutor/Markup.tsx';

const KIND_LABEL: Record<MapNode['kind'], string> = {
  note: 'Nota',
  molecule: 'Estrutura',
  theory: 'Teoria',
  tutor: 'Tutor',
  question: 'Questão',
};

function validSmiles(smiles?: string): boolean {
  if (!smiles) return false;
  try {
    return moleculeFromSmiles(smiles).atoms.length > 0;
  } catch {
    return false;
  }
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}|\n/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i}>
            <Rich text={p} />
          </p>
        ))}
    </>
  );
}

function TheoryBody({ node }: { node: MapNode }) {
  const card = node.lessonId !== undefined && node.card !== undefined ? THEORY[node.lessonId]?.[node.card] : undefined;
  if (!card) return <p className="node-missing">Este cartão de teoria não existe mais.</p>;
  return (
    <>
      {card.body.map((p, i) => (
        <p key={i}>
          <Rich text={p} />
        </p>
      ))}
      {!!card.molecules?.length && (
        <div className="node-figures">
          {card.molecules.slice(0, 2).map((m, i) => (
            <figure key={i} className="paper node-figure">
              <SpecView spec={m} size={18} />
              {m.label && <figcaption>{m.label}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {card.tip && (
        <p className="node-tip">
          <strong>No ENEM:</strong> <Rich text={card.tip} />
        </p>
      )}
    </>
  );
}

export interface NodeViewProps {
  node: MapNode;
  selected: boolean;
  editing: boolean;
  /** Offset while being dragged, before the move is saved. */
  dx: number;
  dy: number;
  onSave: (patch: Partial<MapNode>) => void;
  onStopEditing: () => void;
}

export const NodeView = memo(function NodeView({ node, selected, editing, dx, dy, onSave, onStopEditing }: NodeViewProps) {
  const lesson = node.lessonId ? LESSON_BY_ID[node.lessonId] : undefined;
  const molOk = useMemo(() => validSmiles(node.smiles), [node.smiles]);
  return (
    <div
      className={`node node--${node.kind} node--${node.color}${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`}
      data-node={node.id}
      style={{ transform: `translate(${node.x + dx}px, ${node.y + dy}px)`, width: node.w }}
    >
      <p className="node-kicker">
        {lesson && (
          <span className="node-tile" aria-hidden="true">
            {lesson.element.symbol}
          </span>
        )}
        {KIND_LABEL[node.kind]}
        {lesson ? ` · ${lesson.title}` : ''}
      </p>
      {editing ? (
        <NodeEditor node={node} onSave={onSave} onDone={onStopEditing} />
      ) : (
        <>
          {node.title && <h3 className="node-title">{node.title}</h3>}
          {node.smiles && node.kind !== 'tutor' && (
            <figure className="paper node-mol">{molOk ? <MoleculeView smiles={node.smiles} size={22} title={node.title} /> : <code>{node.smiles}</code>}</figure>
          )}
          <div className="node-body">
            {node.kind === 'theory' ? <TheoryBody node={node} /> : node.kind === 'tutor' ? <Markup text={node.text} /> : node.text ? <Paragraphs text={node.text} /> : null}
          </div>
        </>
      )}
      {selected && !editing && <span className="node-handle" data-handle={node.id} title="Arraste até outro cartão para ligar" aria-hidden="true" />}
    </div>
  );
});

function NodeEditor({ node, onSave, onDone }: { node: MapNode; onSave: (patch: Partial<MapNode>) => void; onDone: () => void }) {
  const [title, setTitle] = useState(node.title);
  const [text, setText] = useState(node.text);
  const [smiles, setSmiles] = useState(node.smiles ?? '');
  const first = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const state = useRef({ title, text, smiles });
  state.current = { title, text, smiles };

  useEffect(() => {
    first.current?.focus();
    first.current?.select();
  }, []);

  const save = () => {
    const s = state.current;
    onSave({ title: s.title.trim(), text: s.text, ...(node.kind === 'molecule' ? { smiles: s.smiles.trim() } : {}) });
  };

  if (node.kind === 'theory') {
    return <p className="node-missing">Cartões da trilha não se editam: mude a cor, ligue a outros cartões ou crie uma nota ao lado.</p>;
  }
  const smilesOk = node.kind !== 'molecule' || validSmiles(smiles.trim());
  return (
    <div
      className="node-editor"
      ref={box}
      onBlur={(e) => {
        // Leaving the card saves it.
        if (!box.current?.contains(e.relatedTarget as Node | null)) {
          save();
          onDone();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          save();
          onDone();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input ref={first} className="node-input node-input--title" value={title} placeholder="Título" aria-label="Título do cartão" onChange={(e) => setTitle(e.target.value)} />
      {node.kind === 'molecule' && (
        <>
          <input
            className="node-input node-input--code"
            value={smiles}
            placeholder="SMILES, ex.: CCO"
            aria-label="Estrutura em SMILES"
            aria-invalid={!smilesOk}
            spellCheck={false}
            onChange={(e) => setSmiles(e.target.value)}
          />
          {smilesOk && smiles.trim() && (
            <figure className="paper node-mol">
              <MoleculeView smiles={smiles.trim()} size={20} />
            </figure>
          )}
        </>
      )}
      <textarea className="node-input" value={text} rows={4} placeholder="Escreva aqui. **Negrito** marca os termos-chave." aria-label="Texto do cartão" onChange={(e) => setText(e.target.value)} />
      <p className="node-editor-hint">Ctrl + Enter ou clique fora para salvar.</p>
    </div>
  );
}
