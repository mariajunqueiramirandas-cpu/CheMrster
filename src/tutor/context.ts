/**
 * What the tutor knows about the learner and the screen when a message is sent. It travels
 * inside the user's message (and is stored with it), so the history the API sees never
 * changes once written and stays in the prompt cache.
 */
import { LESSON_BY_ID, LESSONS } from '../course/course.ts';
import type { Exercise, TheoryCard } from '../course/types.ts';
import { type Progress, currentStreak, dueLessons } from '../app/store.ts';
import { LEVEL_LABEL, KIND_LABEL, accuracyByKind, daysUntil, masteryAll, nextLesson, totals, weakSpots } from '../study/progress.ts';
import { describeExercise } from './tools.ts';

export type ScreenContext =
  | {
      kind: 'question';
      lessonId: string;
      exercise: Exercise;
      /** Undefined while the learner has not answered (a hint is being asked for). */
      chosen?: number | number[];
      correct?: boolean;
    }
  | { kind: 'theory'; lessonId: string; card: TheoryCard }
  | { kind: 'molecule'; smiles: string; name?: string }
  | { kind: 'map-card'; title: string; text: string; smiles?: string; /** The card, so new cards can hang off it. */ nodeId?: string }
  | { kind: 'board'; summary: string }
  | { kind: 'progress' };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const lessonName = (id: string) => (LESSON_BY_ID[id] ? `${LESSON_BY_ID[id].title} [${id}]` : id);

function answerText(ex: Exercise, chosen: number | number[]): string {
  if (ex.kind === 'choice' && typeof chosen === 'number') return `"${ex.options[chosen]}"`;
  if (ex.kind === 'pick' && typeof chosen === 'number') return `a estrutura ${ex.options[chosen]?.smiles}`;
  if (Array.isArray(chosen)) return `os átomos ${chosen.map((a) => a + 1).join(', ')}`;
  return String(chosen);
}

export function describeScreen(ctx: ScreenContext): string {
  switch (ctx.kind) {
    case 'question': {
      const q = JSON.stringify(describeExercise(ctx.exercise));
      const where = `Questão da lição ${lessonName(ctx.lessonId)}: ${q}`;
      if (ctx.chosen === undefined) return `${where}\nO aluno ainda não respondeu e pediu uma dica: ajude a pensar sem revelar o gabarito.`;
      return `${where}\nO aluno respondeu ${answerText(ctx.exercise, ctx.chosen)} e ${ctx.correct ? 'acertou' : 'errou'}.`;
    }
    case 'theory':
      return `Cartão de teoria da lição ${lessonName(ctx.lessonId)}: "${ctx.card.title}". ${ctx.card.body.join(' ')}${ctx.card.tip ? ` No ENEM: ${ctx.card.tip}` : ''}`;
    case 'molecule':
      return `Estrutura aberta no editor: ${ctx.smiles}${ctx.name ? ` (${ctx.name})` : ''}.`;
    case 'map-card':
      return `Cartão do mapa de conceitos: "${ctx.title}". ${ctx.text}${ctx.smiles ? ` Estrutura: ${ctx.smiles}.` : ''}`;
    case 'board':
      return `Quadro de estudos do aluno: ${ctx.summary}`;
    case 'progress':
      return 'O aluno está no painel de progresso.';
  }
}

export interface LearnerInfo {
  name?: string;
  examDate?: string;
  dailyGoal: number;
}

export function learnerSnapshot(p: Progress, info: LearnerInfo, now = new Date()): string {
  const all = masteryAll(p, now);
  const t = totals(p, now);
  const lines: string[] = [];
  if (info.name) lines.push(`Nome: ${info.name}.`);
  const exam = info.examDate ? daysUntil(info.examDate, now) : undefined;
  lines.push(
    `Hoje: ${now.toLocaleDateString('pt-BR')}${exam !== undefined && exam >= 0 ? `; a prova é daqui a ${exam} dias` : ''}.`,
    `XP ${p.xp}; ${currentStreak(p, now)} dias seguidos; meta de ${info.dailyGoal} XP por dia (hoje: ${t.xpToday}).`,
  );
  const started = LESSONS.filter((l) => all[l.id] && all[l.id].level !== 'nova');
  if (started.length) {
    lines.push(
      'Lições já praticadas (domínio de hoje):',
      ...started.map((l) => {
        const m = all[l.id];
        return `- ${lessonName(l.id)}: ${pct(m.mastery)}, ${LEVEL_LABEL[m.level].toLowerCase()}${m.completed ? '' : ', não concluída'}`;
      }),
    );
  } else {
    lines.push('Ainda não praticou nenhuma lição.');
  }
  const due = dueLessons(p, now);
  if (due.length) lines.push(`Revisões vencidas: ${due.map((d) => lessonName(d.id)).join(', ')}.`);
  const weak = weakSpots(all);
  if (weak.length) lines.push(`Pontos fracos: ${weak.map((m) => lessonName(m.id)).join(', ')}.`);
  const next = nextLesson(p);
  if (next) lines.push(`Próxima lição da trilha: ${lessonName(next.id)}.`);
  const kinds = accuracyByKind(p).filter((k) => k.tries >= 5);
  if (kinds.length) lines.push(`Acertos de primeira por formato: ${kinds.map((k) => `${KIND_LABEL[k.kind].toLowerCase()} ${pct(k.right / k.tries)}`).join(', ')}.`);
  return lines.join('\n');
}

/** The hidden part of a user message: learner and screen, in tags the system prompt explains. */
export function messageContext(snapshot: string, screen?: ScreenContext): string {
  return `<aluno>\n${snapshot}\n</aluno>${screen ? `\n<tela>\n${describeScreen(screen)}\n</tela>` : ''}`;
}
