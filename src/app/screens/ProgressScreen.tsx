/**
 * Progress: the lessons as a periodic table filled by how well each is known today, the
 * study calendar, XP by day, the reviews coming up, weak spots and question formats.
 * Every chart has a table view.
 */
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LESSON_BY_ID, LESSONS, unitOf } from '../../course/course.ts';
import type { Lesson } from '../../course/types.ts';
import {
  type DayPoint,
  KIND_LABEL,
  LEVEL_LABEL,
  type LessonMastery,
  type MasteryLevel,
  accuracyByKind,
  calendarWeeks,
  dailySeries,
  daysUntil,
  heatLevel,
  masteryAll,
  nextLesson,
  overallMastery,
  reviewForecast,
  totals,
  unitMastery,
  weakSpots,
} from '../../study/progress.ts';
import { BoltIcon, FlameIcon, TutorIcon } from '../components/Icons.tsx';
import { useMedia, useWidth } from '../hooks.ts';
import { href, navigate } from '../router.ts';
import { useSettings } from '../settings.ts';
import { type Progress, currentStreak, useProgress } from '../store.ts';
import { ask } from '../tutor-store.ts';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const dayName = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const dayLong = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function ProgressScreen() {
  const progress = useProgress();
  const settings = useSettings();
  const now = new Date();
  const all = useMemo(() => masteryAll(progress), [progress]);
  const t = totals(progress);
  const [open, setOpen] = useState<string | null>(null);
  const overall = overallMastery(all);
  const exam = settings.examDate ? daysUntil(settings.examDate) : undefined;
  const goal = settings.dailyGoal;
  const started = Object.values(all).some((m) => m.level !== 'nova');

  return (
    <div className="progress">
      <header className="progress-head">
        <div>
          <h1>Seu progresso</h1>
          <p>
            {started
              ? `Domínio de hoje em toda a trilha: ${pct(overall)}. O domínio cai com o tempo e volta a subir a cada revisão.`
              : 'Conclua lições e revisões: cada resposta entra aqui, e o domínio de cada lição aparece na tabela.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--tutor"
          onClick={() => ask({ text: 'Olhe meu progresso e monte um plano de estudos para esta semana no meu quadro.', screen: { kind: 'progress' }, open: true })}
        >
          <TutorIcon /> Plano com o tutor
        </button>
      </header>

      <section className="goal" aria-label="Meta de hoje">
        <div className="goal-text">
          <p className="goal-label">Meta de hoje</p>
          <p className="goal-value">
            {t.xpToday} <span>de {goal} XP</span>
          </p>
        </div>
        <div className="meter" role="progressbar" aria-label="Meta de hoje" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, t.xpToday)}>
          <span style={{ width: `${Math.min(100, (t.xpToday / goal) * 100)}%` }} />
        </div>
        <p className="goal-note">{t.xpToday >= goal ? 'Meta cumprida. Ótimo dia de estudo.' : `Faltam ${goal - t.xpToday} XP: uma lição vale 10 a 15.`}</p>
      </section>

      <dl className="kpis">
        <Kpi label="Dias seguidos" value={String(currentStreak(progress))} note={`Recorde: ${progress.streak.best ?? progress.streak.count}`} icon={<FlameIcon />} />
        <Kpi label="XP total" value={progress.xp.toLocaleString('pt-BR')} note={`${t.activeDays} ${t.activeDays === 1 ? 'dia' : 'dias'} de estudo`} icon={<BoltIcon />} />
        <Kpi label="Acertos de primeira" value={t.accuracy7 === undefined ? '–' : pct(t.accuracy7)} note="nos últimos 7 dias" />
        <Kpi label="Tempo de estudo" value={`${t.minutes7} min`} note={`nos últimos 7 dias; ${t.questions} questões no total`} />
        {exam !== undefined && exam >= 0 ? (
          <Kpi label="Até a prova" value={exam === 0 ? 'Hoje' : `${exam} ${exam === 1 ? 'dia' : 'dias'}`} note={new Date(`${settings.examDate}T12:00`).toLocaleDateString('pt-BR')} />
        ) : (
          <div className="kpi kpi--action">
            <dt>Data da prova</dt>
            <dd>
              <a href={href({ name: 'settings' })}>Definir em Ajustes</a>
            </dd>
          </div>
        )}
      </dl>

      <section className="panel panel--table" aria-labelledby="table-title">
        <div className="panel-head">
          <h2 id="table-title">Tabela de domínio</h2>
          <p>Cada lição ocupa seu elemento, de H a Ca. Toque para ver os detalhes.</p>
        </div>
        <div className="ptable-wrap">
          <MasteryTable all={all} overall={overall} onOpen={setOpen} />
          <UnitBars all={all} />
        </div>
        <TableView caption="Domínio por lição">
          <thead>
            <tr>
              <th scope="col">Lição</th>
              <th scope="col">Nível</th>
              <th scope="col">Domínio</th>
              <th scope="col">Revisão</th>
            </tr>
          </thead>
          <tbody>
            {LESSONS.filter((l) => all[l.id]).map((l) => (
              <tr key={l.id}>
                <th scope="row">
                  {l.element.symbol} · {l.title}
                </th>
                <td>{LEVEL_LABEL[all[l.id].level]}</td>
                <td>{pct(all[l.id].mastery)}</td>
                <td>{dueText(all[l.id])}</td>
              </tr>
            ))}
          </tbody>
        </TableView>
      </section>

      <div className="progress-grid">
        <section className="panel" aria-labelledby="calendar-title">
          <div className="panel-head">
            <h2 id="calendar-title">Calendário de estudo</h2>
            <p>XP por dia. O tom forte marca os dias em que a meta foi cumprida.</p>
          </div>
          <StudyCalendar progress={progress} goal={goal} />
        </section>

        <section className="panel" aria-labelledby="xp-title">
          <div className="panel-head">
            <h2 id="xp-title">XP nos últimos 14 dias</h2>
            <p>A linha tracejada é a sua meta diária, marcada em negrito no eixo.</p>
          </div>
          <XpChart days={dailySeries(progress, 14, now)} goal={goal} />
        </section>

        <section className="panel" aria-labelledby="forecast-title">
          <div className="panel-head">
            <h2 id="forecast-title">Próximas revisões</h2>
            <p>Cada lição volta quando está para ser esquecida.</p>
          </div>
          <Forecast progress={progress} />
        </section>

        <section className="panel" aria-labelledby="weak-title">
          <div className="panel-head">
            <h2 id="weak-title">Para reforçar</h2>
            <p>As lições com menor domínio hoje.</p>
          </div>
          <WeakSpots all={all} progress={progress} />
        </section>

        <section className="panel" aria-labelledby="kind-title">
          <div className="panel-head">
            <h2 id="kind-title">Por formato de questão</h2>
            <p>Acertos de primeira em cada tipo de exercício.</p>
          </div>
          <KindBars progress={progress} />
        </section>
      </div>

      {open && <LessonSheet mastery={all[open]} lesson={LESSON_BY_ID[open]} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Kpi({ label, value, note, icon }: { label: string; value: string; note: string; icon?: ReactNode }) {
  return (
    <div className="kpi">
      <dt>
        {icon}
        {label}
      </dt>
      <dd>
        <span className="kpi-value">{value}</span>
        <span className="kpi-note">{note}</span>
      </dd>
    </div>
  );
}

function TableView({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <details className="table-view">
      <summary>Ver como tabela</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}

function dueText(m: LessonMastery): string {
  if (!m.completed || m.dueIn === undefined) return '–';
  if (m.dueIn < 0) return `atrasada ${-m.dueIn} ${m.dueIn === -1 ? 'dia' : 'dias'}`;
  if (m.dueIn === 0) return 'hoje';
  if (m.dueIn === 1) return 'amanhã';
  return `em ${m.dueIn} dias`;
}

// ---------------------------------------------------------------------------
// The periodic table of lessons

/** Main-group layout: H and He on row 1, then eight columns per row. */
function cell(n: number): { row: number; col: number } {
  if (n === 1) return { row: 1, col: 1 };
  if (n === 2) return { row: 1, col: 8 };
  if (n <= 10) return { row: 2, col: n - 2 };
  if (n <= 18) return { row: 3, col: n - 10 };
  return { row: 4, col: n - 18 };
}

const LEVELS: MasteryLevel[] = ['nova', 'fraca', 'media', 'forte'];

function MasteryTable({ all, overall, onOpen }: { all: Record<string, LessonMastery>; overall: number; onOpen: (id: string) => void }) {
  return (
    <div className="ptable">
      {LESSONS.map((l) => {
        const m = all[l.id];
        const { row, col } = cell(l.element.number);
        return (
          <button
            key={l.id}
            type="button"
            className={`ptile ptile--${m?.level ?? 'nova'}`}
            style={{ gridRow: row, gridColumn: col } as CSSProperties}
            onClick={() => onOpen(l.id)}
            aria-label={`Lição ${l.element.number}, ${l.title}: ${m ? `${LEVEL_LABEL[m.level].toLowerCase()}, domínio ${pct(m.mastery)}` : 'em breve'}`}
          >
            <span className="ptile-n">{l.element.number}</span>
            <span className="ptile-s">{l.element.symbol}</span>
            <span className="ptile-m">{m && m.level !== 'nova' ? pct(m.mastery) : ''}</span>
          </button>
        );
      })}
      <div className="ptable-key" style={{ gridRow: 1, gridColumn: '2 / 8' }}>
        <span className="ptable-overall">{pct(overall)}</span>
        <span className="ptable-overall-label">domínio da trilha</span>
      </div>
      <ul className="ptable-legend" style={{ gridRow: 4, gridColumn: '3 / 9' }} aria-label="Legenda">
        {LEVELS.map((lv) => (
          <li key={lv}>
            <span className={`swatch swatch--${lv}`} aria-hidden="true" />
            {LEVEL_LABEL[lv]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnitBars({ all }: { all: Record<string, LessonMastery> }) {
  return (
    <ul className="unit-bars">
      {unitMastery(all).map((u) => (
        <li key={u.id}>
          <span className="unit-bars-title">{u.title}</span>
          <span className="meter meter--thin" aria-hidden="true">
            <span style={{ width: pct(u.mastery) }} />
          </span>
          <span className="unit-bars-value">
            {pct(u.mastery)}
            <span className="sr-only">
              {' '}
              de domínio; {u.done} de {u.total} lições concluídas
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LessonSheet({ mastery: m, lesson, onClose }: { mastery?: LessonMastery; lesson: Lesson; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const unit = unitOf(lesson.id);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="sheet-body">
        <span className={`ptile ptile--${m?.level ?? 'nova'} ptile--large`} aria-hidden="true">
          <span className="ptile-n">{lesson.element.number}</span>
          <span className="ptile-s">{lesson.element.symbol}</span>
        </span>
        <div className="sheet-text">
          <h3>{lesson.title}</h3>
          <p>{unit.title}</p>
        </div>
      </div>
      {m ? (
        <dl className="lesson-facts">
          <div>
            <dt>Domínio hoje</dt>
            <dd>
              {pct(m.mastery)} · {LEVEL_LABEL[m.level].toLowerCase()}
            </dd>
          </div>
          <div>
            <dt>Acertos recentes</dt>
            <dd>{m.evidence ? `${pct(m.skill)} em ${m.evidence} ${m.evidence === 1 ? 'questão' : 'questões'}` : '–'}</dd>
          </div>
          <div>
            <dt>Memória</dt>
            <dd>{m.completed ? pct(m.retention) : '–'}</dd>
          </div>
          <div>
            <dt>Revisão</dt>
            <dd>{dueText(m)}</dd>
          </div>
        </dl>
      ) : (
        <p className="sheet-note">Esta lição ainda está sendo escrita.</p>
      )}
      <div className="sheet-actions">
        {lesson.generate && (
          <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'lesson', id: lesson.id })} autoFocus>
            {m?.completed ? 'Praticar de novo' : 'Começar lição'}
          </button>
        )}
        {lesson.generate && (
          <button
            type="button"
            className="btn btn--tutor"
            onClick={() => {
              onClose();
              ask({ text: `Me testa em ${lesson.title.toLowerCase()} e me explica o que eu errar.`, about: `Lição ${lesson.element.symbol}: ${lesson.title}`, open: true });
            }}
          >
            <TutorIcon /> Treinar com o tutor
          </button>
        )}
        {!!lesson.theory?.length && (
          <a className="btn" href={href({ name: 'theory', id: lesson.id })}>
            Ver teoria
          </a>
        )}
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Fechar
        </button>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Study calendar

function StudyCalendar({ progress, goal }: { progress: Progress; goal: number }) {
  const wide = useMedia('(min-width: 900px)');
  const weeks = useMemo(() => calendarWeeks(progress, wide ? 22 : 16), [progress, wide]);
  const days = weeks.flat().filter((d) => !d.future);
  const [active, setActive] = useState<number>(days.length - 1);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? active;
  const current = days[Math.min(shown, days.length - 1)];
  const flatIndex = (w: number, d: number) => w * 7 + d;
  const studied = days.filter((d) => d.xp > 0).length;

  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setHover(null);
    setActive((a) => Math.max(0, Math.min(days.length - 1, a + step)));
  };

  // Month names over the week each month starts in; a month that starts in the last two
  // columns of the left edge would collide with the next one, so it goes unnamed.
  const starts = weeks.map((w, i) => i === 0 || w[0].date.getMonth() !== weeks[i - 1][0].date.getMonth());
  const months = weeks.map((w, i) =>
    starts[i] && !(i === 0 && (starts[1] || starts[2])) ? w[0].date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '',
  );

  return (
    <div className="calendar">
      <div className="calendar-scroll">
        <div className="calendar-months" style={{ '--weeks': weeks.length } as CSSProperties} aria-hidden="true">
          {months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className="calendar-body">
          <div className="calendar-days" aria-hidden="true">
            <span />
            <span>seg</span>
            <span />
            <span>qua</span>
            <span />
            <span>sex</span>
            <span />
          </div>
          <div
            className="calendar-grid"
            style={{ '--weeks': weeks.length } as CSSProperties}
            role="grid"
            tabIndex={0}
            aria-label={`Calendário de estudo: ${studied} dias com estudo nas últimas ${weeks.length} semanas. Use as setas para percorrer os dias.`}
            aria-activedescendant={`day-${current?.key}`}
            onKeyDown={onKey}
            onMouseLeave={() => setHover(null)}
          >
            {weeks.map((w, wi) =>
              w.map((d, di) => {
                const i = flatIndex(wi, di);
                return (
                  <span
                    key={d.key}
                    id={`day-${d.key}`}
                    role="gridcell"
                    aria-selected={i === shown}
                    className={`heat heat--${d.future ? 'future' : heatLevel(d.xp, goal)}${i === shown ? ' is-active' : ''}`}
                    onMouseEnter={() => !d.future && setHover(i)}
                    aria-label={d.future ? undefined : `${dayLong(d.date)}: ${d.xp} XP`}
                  />
                );
              }),
            )}
          </div>
        </div>
      </div>
      <div className="calendar-foot">
        <p className="calendar-readout" aria-live="polite">
          {current && (
            <>
              <strong>{current.xp} XP</strong> {dayLong(current.date)}
              {current.answered > 0 && (
                <span>
                  {' '}
                  · {current.answered} {current.answered === 1 ? 'questão' : 'questões'}
                  {current.accuracy !== undefined ? `, ${pct(current.accuracy)} de primeira` : ''}
                </span>
              )}
            </>
          )}
        </p>
        <span className="heat-scale" aria-hidden="true">
          menos
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heat heat--${l}`} />
          ))}
          mais
        </span>
      </div>
      <TableView caption="XP por dia">
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">XP</th>
            <th scope="col">Questões</th>
            <th scope="col">Acertos de primeira</th>
          </tr>
        </thead>
        <tbody>
          {days
            .filter((d) => d.xp || d.answered)
            .reverse()
            .map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.date.toLocaleDateString('pt-BR')}</th>
                <td>{d.xp}</td>
                <td>{d.answered}</td>
                <td>{d.accuracy === undefined ? '–' : pct(d.accuracy)}</td>
              </tr>
            ))}
        </tbody>
      </TableView>
    </div>
  );
}

// ---------------------------------------------------------------------------
// XP columns

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / (mag / 2)) * (mag / 2);
}

function XpChart({ days, goal }: { days: DayPoint[]; goal: number }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 480);
  const [active, setActive] = useState<number | null>(null);
  const height = 190;
  const pad = { l: 34, r: 8, t: 14, b: 26 };
  const max = niceMax(Math.max(goal * 1.25, ...days.map((d) => d.xp)));
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const band = plotW / days.length;
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = goal < max ? [0, goal, max] : [0, max];
  const any = days.some((d) => d.xp > 0);
  const shown = active === null ? undefined : days[active];

  return (
    <div className="xp-chart" ref={box}>
      <svg width={width} height={height} role="img" aria-label={`XP por dia nos últimos 14 dias; meta de ${goal} XP.`}>
        {ticks.map((t) => (
          <g key={t} className={t === goal ? 'axis axis--goal' : 'axis'}>
            {t !== goal && <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />}
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <line className="goal-line" x1={pad.l} x2={width - pad.r} y1={y(goal)} y2={y(goal)} />
        {days.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.xp));
          const r = Math.min(4, h, barW / 2);
          const x0 = cx - barW / 2;
          const top = y(d.xp);
          const label = i === days.length - 1 ? 'hoje' : i % 2 === (days.length - 1) % 2 ? String(d.date.getDate()) : '';
          return (
            <g
              key={d.key}
              className={`bar${i === active ? ' is-active' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${dayLong(d.date)}: ${d.xp} XP`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect className="bar-hit" x={cx - band / 2} y={pad.t} width={band} height={plotH} />
              {h > 0 && <path d={`M${x0} ${y(0)}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + barW - r}Q${x0 + barW} ${top} ${x0 + barW} ${top + r}V${y(0)}Z`} />}
              <text className="axis-label" x={cx} y={height - 8} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
        <line className="baseline" x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} />
      </svg>
      {!any && <p className="chart-empty">Nenhum XP nestes dias ainda. Uma lição já aparece aqui.</p>}
      <p className="chart-readout" aria-hidden="true">
        {shown ? (
          <>
            <strong>{shown.xp} XP</strong> {dayName(shown.date)}, {shown.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            {shown.answered ? ` · ${shown.answered} questões` : ''}
          </>
        ) : (
          <>
            <strong>{days.reduce((s, d) => s + d.xp, 0)} XP</strong> em 14 dias
          </>
        )}
      </p>
      <TableView caption="XP nos últimos 14 dias">
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">XP</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.date.toLocaleDateString('pt-BR')}</th>
              <td>{d.xp}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews, weak spots, formats

function Forecast({ progress }: { progress: Progress }) {
  const days = reviewForecast(progress, 7);
  const total = days.reduce((s, d) => s + d.lessons.length, 0);
  if (!Object.keys(progress.completed).length) {
    return <p className="panel-empty">As revisões aparecem depois da primeira lição concluída.</p>;
  }
  return (
    <>
      <ol className="forecast">
        {days.map((d, i) => (
          <li key={d.key} className={d.lessons.length ? 'has-reviews' : ''}>
            <span className="forecast-day">{i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayName(d.date)}</span>
            <span className="forecast-count">{d.lessons.length || '–'}</span>
            <span className="forecast-tiles">
              {d.lessons.slice(0, 4).map((id) => (
                <span key={id} className="mini-tile" title={LESSON_BY_ID[id]?.title}>
                  {LESSON_BY_ID[id]?.element.symbol}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
      {days[0].lessons.length > 0 ? (
        <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'review' })}>
          <BoltIcon /> Revisar agora
        </button>
      ) : (
        <p className="panel-note">{total ? 'Nada para hoje: aproveite para avançar na trilha.' : 'Nenhuma revisão nesta semana.'}</p>
      )}
    </>
  );
}

function WeakSpots({ all, progress }: { all: Record<string, LessonMastery>; progress: Progress }) {
  const weak = weakSpots(all, 4);
  if (!weak.length) {
    const next = nextLesson(progress);
    return (
      <div className="panel-empty">
        <p>{Object.keys(progress.completed).length ? 'Nenhuma lição fraca agora. Continue revisando no tempo certo.' : 'Ainda não há lições praticadas.'}</p>
        {next && (
          <a className="btn" href={href({ name: 'lesson', id: next.id })}>
            Próxima lição: {next.title}
          </a>
        )}
      </div>
    );
  }
  return (
    <ul className="weak">
      {weak.map((m) => {
        const l = LESSON_BY_ID[m.id];
        return (
          <li key={m.id}>
            <span className={`ptile ptile--${m.level} ptile--small`} aria-hidden="true">
              <span className="ptile-s">{l.element.symbol}</span>
            </span>
            <span className="weak-text">
              <strong>{l.title}</strong>
              <span>
                {pct(m.mastery)} · {LEVEL_LABEL[m.level].toLowerCase()}
              </span>
            </span>
            <a className="btn btn--small" href={href({ name: 'lesson', id: m.id })}>
              Praticar
            </a>
            <button
              type="button"
              className="icon-btn icon-btn--tutor"
              aria-label={`Treinar ${l.title} com o tutor`}
              onClick={() => ask({ text: `Me ajuda a reforçar ${l.title.toLowerCase()}: explica o essencial e me testa.`, about: `Lição ${l.element.symbol}: ${l.title}`, open: true })}
            >
              <TutorIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function KindBars({ progress }: { progress: Progress }) {
  const kinds = accuracyByKind(progress);
  if (!kinds.some((k) => k.tries)) return <p className="panel-empty">Responda algumas questões para ver seus acertos por formato.</p>;
  return (
    <ul className="kind-bars">
      {kinds.map((k) => (
        <li key={k.kind}>
          <span className="kind-bars-label">{KIND_LABEL[k.kind]}</span>
          <span className="meter meter--thin" aria-hidden="true">
            <span style={{ width: k.tries ? pct(k.right / k.tries) : '0%' }} />
          </span>
          <span className="kind-bars-value">
            {k.tries ? pct(k.right / k.tries) : '–'}
            <span className="kind-bars-n">
              {k.tries} {k.tries === 1 ? 'questão' : 'questões'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
