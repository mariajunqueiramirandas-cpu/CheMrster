/** The tutor's markup on screen: text, lists, structures drawn ENEM-style and links to lessons. */
import { Fragment, memo, useMemo } from 'react';
import { LESSON_BY_ID } from '../../../course/course.ts';
import { moleculeFromSmiles } from '../../../nanquim/index.ts';
import { type Block, type Inline, parseMarkup } from '../../../tutor/markup.ts';
import { href } from '../../router.ts';
import { closeTutor } from '../../tutor-store.ts';
import { MoleculeView } from '../MoleculeView.tsx';

function InlineView({ inline }: { inline: Inline[] }) {
  return (
    <>
      {inline.map((x, i) => {
        if (x.type === 'bold') return <strong key={i}>{x.text}</strong>;
        if (x.type === 'code') return <code key={i}>{x.text}</code>;
        if (x.type === 'lesson') return <LessonLink key={i} id={x.id} />;
        return <Fragment key={i}>{x.text}</Fragment>;
      })}
    </>
  );
}

/** "Praticar: Adição" with the lesson's element tile; opens the lesson. */
export function LessonLink({ id }: { id: string }) {
  const lesson = LESSON_BY_ID[id];
  if (!lesson) return <>{id}</>;
  return (
    <a className="lesson-link" href={href({ name: 'lesson', id })} onClick={() => closeTutor()}>
      <span className="lesson-link-tile" aria-hidden="true">
        {lesson.element.symbol}
      </span>
      <span>
        Praticar: <strong>{lesson.title}</strong>
      </span>
    </a>
  );
}

/** A structure the tutor wrote; an invalid SMILES shows as text instead of breaking the reply. */
function MolBlock({ smiles, name }: { smiles: string; name?: string }) {
  const ok = useMemo(() => {
    try {
      return moleculeFromSmiles(smiles).atoms.length > 0;
    } catch {
      return false;
    }
  }, [smiles]);
  if (!ok) return <code className="md-smiles">{smiles}</code>;
  return (
    <figure className="paper md-mol">
      <a href={href({ name: 'studio', smiles })} onClick={() => closeTutor()} aria-label={`Abrir ${name || 'a estrutura'} em Estruturas`}>
        <MoleculeView smiles={smiles} size={24} title={name} animate />
      </a>
      {name && <figcaption>{name}</figcaption>}
    </figure>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <InlineView inline={block.inline} />
        </p>
      );
    case 'h':
      return (
        <p className="md-h">
          <InlineView inline={block.inline} />
        </p>
      );
    case 'ul':
    case 'ol': {
      const List = block.type;
      return (
        <List>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineView inline={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'mol':
      return <MolBlock smiles={block.smiles} name={block.name} />;
  }
}

export const Markup = memo(function Markup({ text, streaming }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => parseMarkup(text, { streaming }), [text, streaming]);
  return (
    <div className="md">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
});
