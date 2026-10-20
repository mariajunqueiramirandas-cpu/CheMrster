/**
 * Progress (src/app/screens/ProgressScreen.tsx): the lessons as a periodic table filled by
 * how well each is known today, the study calendar, XP by day, the reviews coming up, weak
 * spots and question formats. Every chart has a table view.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { LESSON_BY_ID, LESSONS, unitOf } from '../../../src/course/course.ts';
import type { Lesson } from '../../../src/course/types.ts';
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
} from '../../../src/study/progress.ts';
import { useSettings } from '../../../src/app/settings.ts';
import { type Progress, currentStreak, useProgress } from '../../../src/app/store.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { go } from '../lib/nav.ts';
import { heat } from '../progress/heat.ts';
import { MasteryTile } from '../progress/MasteryTile.tsx';
import { COLUMN, FONT, GUTTER, SIZE, useTheme } from '../theme.ts';
import { BackBar } from '../ui/Bars.tsx';
import { BoltIcon, ChevronRightIcon, FlameIcon, TutorIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Meter, Press, Txt } from '../ui/kit.tsx';
import { Page } from '../ui/Page.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const dayName = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const dayLong = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

/** The page's usable width. */
function useColumn() {
  const { width } = useWindowDimensions();
  return Math.min(width, COLUMN) - GUTTER * 2;
}

export function ProgressScreen() {
  const c = useTheme();
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
    <Page header={<BackBar title="Progresso" />}>
      <View style={styles.head}>
        <Txt variant="display" accessibilityRole="header">
          Seu progresso
        </Txt>
        <Txt tone="muted">
          {started
            ? `Domínio de hoje em toda a trilha: ${pct(overall)}. O domínio cai com o tempo e volta a subir a cada revisão.`
            : 'Conclua lições e revisões: cada resposta entra aqui, e o domínio de cada lição aparece na tabela.'}
        </Txt>
        <Btn
          kind="tutor"
          label="Plano com o tutor"
          icon={(color) => <TutorIcon color={color} />}
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
          onPress={() => ask({ text: 'Olhe meu progresso e monte um plano de estudos para esta semana no meu quadro.', screen: { kind: 'progress' }, open: true })}
        />
      </View>

      <View style={[styles.goal, { backgroundColor: c.surface, borderColor: c.benchDeep }]} accessibilityLabel="Meta de hoje">
        <View style={styles.goalText}>
          <Txt variant="kicker" tone="muted">
            Meta de hoje
          </Txt>
          <Text style={[styles.goalValue, { color: c.text }]}>
            {t.xpToday} <Text style={[styles.goalOf, { color: c.muted }]}>de {goal} XP</Text>
          </Text>
        </View>
        <Meter value={t.xpToday / goal} color={t.xpToday >= goal ? c.right : undefined} />
        <Txt variant="small" tone="muted">
          {t.xpToday >= goal ? 'Meta cumprida. Ótimo dia de estudo.' : `Faltam ${goal - t.xpToday} XP: uma lição vale 10 a 15.`}
        </Txt>
      </View>

      <View style={styles.kpis}>
        <Kpi
          label="Dias seguidos"
          value={String(currentStreak(progress))}
          note={`Recorde: ${progress.streak.best ?? progress.streak.count}`}
          icon={<FlameIcon width={16} height={16} color={c.magenta} />}
        />
        <Kpi
          label="XP total"
          value={progress.xp.toLocaleString('pt-BR')}
          note={`${t.activeDays} ${t.activeDays === 1 ? 'dia' : 'dias'} de estudo`}
          icon={<BoltIcon width={16} height={16} color={c.amber} />}
        />
        <Kpi label="Acertos de primeira" value={t.accuracy7 === undefined ? '–' : pct(t.accuracy7)} note="nos últimos 7 dias" />
        <Kpi label="Tempo de estudo" value={`${t.minutes7} min`} note={`nos últimos 7 dias; ${t.questions} questões no total`} />
        {exam !== undefined && exam >= 0 ? (
          <Kpi
            label="Até a prova"
            value={exam === 0 ? 'Hoje' : `${exam} ${exam === 1 ? 'dia' : 'dias'}`}
            note={new Date(`${settings.examDate}T12:00`).toLocaleDateString('pt-BR')}
          />
        ) : (
          <Press onPress={() => go({ name: 'settings' })} accessibilityRole="link" style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.benchDeep }]}>
            <Txt variant="small" tone="muted" style={{ fontFamily: FONT.uiBold }}>
              Data da prova
            </Txt>
            <Text style={[styles.kpiLink, { color: c.magenta }]}>Definir em Ajustes</Text>
          </Press>
        )}
      </View>

      <Panel title="Tabela de domínio" note="Cada lição ocupa seu elemento, de H a Ca. Toque para ver os detalhes.">
        <MasteryTable all={all} overall={overall} onOpen={setOpen} />
        <UnitBars all={all} />
        <TableView
          head={['Lição', 'Nível', 'Domínio', 'Revisão']}
          rows={LESSONS.filter((l) => all[l.id]).map((l) => [`${l.element.symbol} · ${l.title}`, LEVEL_LABEL[all[l.id].level], pct(all[l.id].mastery), dueText(all[l.id])])}
        />
      </Panel>

      <Panel title="Calendário de estudo" note="XP por dia. O tom forte marca os dias em que a meta foi cumprida.">
        <StudyCalendar progress={progress} goal={goal} />
      </Panel>

      <Panel title="XP nos últimos 14 dias" note="A linha tracejada é a sua meta diária, marcada em negrito no eixo.">
        <XpChart days={dailySeries(progress, 14, now)} goal={goal} />
      </Panel>

      <Panel title="Próximas revisões" note="Cada lição volta quando está para ser esquecida.">
        <Forecast progress={progress} />
      </Panel>

      <Panel title="Para reforçar" note="As lições com menor domínio hoje.">
        <WeakSpots all={all} progress={progress} />
      </Panel>

      <Panel title="Por formato de questão" note="Acertos de primeira em cada tipo de exercício.">
        <KindBars progress={progress} />
      </Panel>

      {open && <LessonSheet mastery={all[open]} lesson={LESSON_BY_ID[open]} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.benchDeep }]}>
      <View style={{ gap: 2 }}>
        <Txt variant="heading" accessibilityRole="header">
          {title}
        </Txt>
        <Txt variant="small" tone="muted">
          {note}
        </Txt>
      </View>
      {children}
    </View>
  );
}

function Kpi({ label, value, note, icon }: { label: string; value: string; note: string; icon?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.benchDeep }]} accessible accessibilityLabel={`${label}: ${value}, ${note}`}>
      <View style={styles.kpiLabel}>
        {icon}
        <Text style={[styles.kpiLabelText, { color: c.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.kpiNote, { color: c.muted }]}>{note}</Text>
    </View>
  );
}

/** "Ver como tabela": the numbers behind a chart, folded away. */
function TableView({ head, rows }: { head: string[]; rows: string[][] }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Press onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.summary}>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <ChevronRightIcon width={16} height={16} color={c.muted} />
        </View>
        <Text style={[styles.summaryText, { color: c.muted }]}>Ver como tabela</Text>
      </Press>
      {open &&
        (rows.length ? (
          <View style={[styles.table, { borderColor: c.benchDeep }]}>
            <View style={[styles.tr, { borderBottomColor: c.rule }]}>
              {head.map((h, i) => (
                <Text key={h} style={[styles.th, i === 0 && styles.first, { color: c.muted }]}>
                  {h}
                </Text>
              ))}
            </View>
            {rows.map((r, k) => (
              <View key={k} style={[styles.tr, { borderBottomColor: c.benchDeep }]}>
                {r.map((cell, i) => (
                  <Text key={i} style={[styles.td, i === 0 && styles.first, { color: c.text }, i === 0 && { fontFamily: FONT.uiBold }]}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Txt variant="small" tone="muted">
            Nada registrado ainda.
          </Txt>
        ))}
    </View>
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
const GAP = 4;

function MasteryTable({ all, overall, onOpen }: { all: Record<string, LessonMastery>; overall: number; onOpen: (id: string) => void }) {
  const c = useTheme();
  const column = useColumn() - 28;
  const size = Math.floor((column - GAP * 7) / 8);
  const at = (row: number, col: number) => ({ position: 'absolute' as const, top: (row - 1) * (size + GAP + 3), left: (col - 1) * (size + GAP) });
  const h = heat(c);
  return (
    <View style={{ width: column, height: 4 * (size + GAP + 3), alignSelf: 'center' }}>
      {LESSONS.map((l) => {
        const m = all[l.id];
        const { row, col } = cell(l.element.number);
        return (
          <View key={l.id} style={at(row, col)}>
            <MasteryTile
              symbol={l.element.symbol}
              number={l.element.number}
              level={m?.level ?? 'nova'}
              label={m && m.level !== 'nova' && size >= 40 ? pct(m.mastery) : undefined}
              size={size}
              onPress={() => onOpen(l.id)}
              accessibilityLabel={`Lição ${l.element.number}, ${l.title}: ${m ? `${LEVEL_LABEL[m.level].toLowerCase()}, domínio ${pct(m.mastery)}` : 'em breve'}`}
            />
          </View>
        );
      })}
      <View style={[at(1, 2), styles.overall, { width: 6 * size + 5 * GAP, height: size }]}>
        <Text style={[styles.overallValue, { color: c.text, fontSize: Math.min(30, size * 0.62) }]}>{pct(overall)}</Text>
        <Text style={[styles.overallLabel, { color: c.muted }]}>domínio da trilha</Text>
      </View>
      <View style={[at(4, 3), styles.legend, { width: 6 * size + 5 * GAP, height: size }]} accessibilityLabel="Legenda">
        {LEVELS.map((lv) => {
          const t = h.tile(lv);
          return (
            <View key={lv} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: t.bg, borderColor: t.border, borderStyle: t.dashed ? 'dashed' : 'solid', borderWidth: t.dashed ? 1.5 : 0 }]} />
              <Text style={[styles.legendText, { color: c.muted }]}>{LEVEL_LABEL[lv]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function UnitBars({ all }: { all: Record<string, LessonMastery> }) {
  const c = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {unitMastery(all).map((u) => (
        <View key={u.id} style={styles.barRow} accessible accessibilityLabel={`${u.title}: ${pct(u.mastery)} de domínio; ${u.done} de ${u.total} lições concluídas`}>
          <Text style={[styles.barLabel, { color: c.text }]} numberOfLines={1}>
            {u.title}
          </Text>
          <Meter value={u.mastery} height={8} style={{ flex: 1 }} />
          <Text style={[styles.barValue, { color: c.muted }]}>{pct(u.mastery)}</Text>
        </View>
      ))}
    </View>
  );
}

function LessonSheet({ mastery: m, lesson, onClose }: { mastery?: LessonMastery; lesson: Lesson; onClose: () => void }) {
  const c = useTheme();
  const unit = unitOf(lesson.id);
  const leave = (fn: () => void) => {
    onClose();
    fn();
  };
  const facts: Array<[string, string]> = m
    ? [
        ['Domínio hoje', `${pct(m.mastery)} · ${LEVEL_LABEL[m.level].toLowerCase()}`],
        ['Acertos recentes', m.evidence ? `${pct(m.skill)} em ${m.evidence} ${m.evidence === 1 ? 'questão' : 'questões'}` : '–'],
        ['Memória', m.completed ? pct(m.retention) : '–'],
        ['Revisão', dueText(m)],
      ]
    : [];
  return (
    <Sheet visible onClose={onClose}>
      <View style={styles.sheetBody}>
        <MasteryTile symbol={lesson.element.symbol} number={lesson.element.number} level={m?.level ?? 'nova'} size={96} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="title">{lesson.title}</Txt>
          <Txt tone="muted">{unit.title}</Txt>
        </View>
      </View>
      {m ? (
        <View style={styles.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={[styles.fact, { backgroundColor: c.surface, borderColor: c.benchDeep }]}>
              <Txt variant="small" tone="muted" style={{ fontFamily: FONT.uiBold }}>
                {k}
              </Txt>
              <Txt variant="strong">{v}</Txt>
            </View>
          ))}
        </View>
      ) : (
        <Txt variant="small" tone="magenta" style={{ fontFamily: FONT.uiBold, marginTop: 12 }}>
          Esta lição ainda está sendo escrita.
        </Txt>
      )}
      <View style={styles.sheetActions}>
        {lesson.generate && (
          <Btn kind="primary" wide label={m?.completed ? 'Praticar de novo' : 'Começar lição'} onPress={() => leave(() => go({ name: 'lesson', id: lesson.id }))} />
        )}
        {lesson.generate && (
          <Btn
            kind="tutor"
            wide
            label="Treinar com o tutor"
            icon={(color) => <TutorIcon color={color} />}
            onPress={() =>
              leave(() => ask({ text: `Me testa em ${lesson.title.toLowerCase()} e me explica o que eu errar.`, about: `Lição ${lesson.element.symbol}: ${lesson.title}`, open: true }))
            }
          />
        )}
        {!!lesson.theory?.length && <Btn wide label="Ver teoria" onPress={() => leave(() => go({ name: 'theory', id: lesson.id }))} />}
        <Btn kind="quiet" wide label="Fechar" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Study calendar

function StudyCalendar({ progress, goal }: { progress: Progress; goal: number }) {
  const c = useTheme();
  const h = heat(c);
  const column = useColumn() - 28;
  const labelW = 30;
  // As many weeks as fit at a comfortable cell size, between 12 and 22.
  const weeksShown = Math.max(12, Math.min(22, Math.floor((column - labelW) / 18)));
  const weeks = useMemo(() => calendarWeeks(progress, weeksShown), [progress, weeksShown]);
  const days = weeks.flat().filter((d) => !d.future);
  const [active, setActive] = useState<string | undefined>(undefined);
  const current = days.find((d) => d.key === active) ?? days[days.length - 1];
  const gap = 3;
  const size = Math.floor((column - labelW - gap * (weeks.length - 1)) / weeks.length);

  // Month names over the week each month starts in; a month starting in one of the first
  // two columns would collide with the next one, so it goes unnamed.
  const starts = weeks.map((w, i) => i === 0 || w[0].date.getMonth() !== weeks[i - 1][0].date.getMonth());
  const months = weeks.map((w, i) =>
    starts[i] && !(i === 0 && (starts[1] || starts[2])) ? w[0].date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '',
  );
  const studied = days.filter((d) => d.xp > 0).length;

  return (
    <View style={{ gap: 10 }}>
      <View accessible accessibilityLabel={`Calendário de estudo: ${studied} dias com estudo nas últimas ${weeks.length} semanas.`}>
        <View style={{ flexDirection: 'row', marginLeft: labelW, height: 18 }}>
          {months.map((m, i) => (
            <View key={i} style={{ width: size + gap, overflow: 'visible' }}>
              <Text style={[styles.calLabel, { color: c.muted, width: 40 }]} numberOfLines={1}>
                {m}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: labelW, gap }}>
            {['', 'seg', '', 'qua', '', 'sex', ''].map((d, i) => (
              <Text key={i} style={[styles.calLabel, { color: c.muted, height: size, lineHeight: size }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap }}>
            {weeks.map((w, wi) => (
              <View key={wi} style={{ gap }}>
                {w.map((d) => {
                  const on = !d.future && d.key === current?.key;
                  return (
                    <Press
                      key={d.key}
                      tap={false}
                      sink={0}
                      disabled={d.future}
                      onPress={() => setActive(d.key)}
                      accessibilityLabel={d.future ? undefined : `${dayLong(d.date)}: ${d.xp} XP`}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: 3,
                        backgroundColor: d.future ? 'transparent' : h.cell(heatLevel(d.xp, goal)),
                        borderWidth: on ? 2 : 0,
                        borderColor: c.text,
                      }}
                    >
                      <View />
                    </Press>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.calFoot}>
        <Text style={[styles.readout, { color: c.text }]} accessibilityLiveRegion="polite">
          {current && (
            <>
              <Text style={{ fontFamily: FONT.uiBold }}>{current.xp} XP</Text> {dayLong(current.date)}
              {current.answered > 0 && (
                <Text style={{ color: c.muted }}>
                  {' '}
                  · {current.answered} {current.answered === 1 ? 'questão' : 'questões'}
                  {current.accuracy !== undefined ? `, ${pct(current.accuracy)} de primeira` : ''}
                </Text>
              )}
            </>
          )}
        </Text>
        <View style={styles.scale} importantForAccessibility="no-hide-descendants">
          <Text style={[styles.calLabel, { color: c.muted }]}>menos</Text>
          {[0, 1, 2, 3, 4].map((l) => (
            <View key={l} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: h.cell(l) }} />
          ))}
          <Text style={[styles.calLabel, { color: c.muted }]}>mais</Text>
        </View>
      </View>
      <TableView
        head={['Dia', 'XP', 'Questões', 'Acertos de primeira']}
        rows={days
          .filter((d) => d.xp || d.answered)
          .reverse()
          .map((d) => [d.date.toLocaleDateString('pt-BR'), String(d.xp), String(d.answered), d.accuracy === undefined ? '–' : pct(d.accuracy)])}
      />
    </View>
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
  const c = useTheme();
  const width = useColumn() - 28;
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
    <View style={{ gap: 6 }}>
      <Svg width={width} height={height} accessibilityLabel={`XP por dia nos últimos 14 dias; meta de ${goal} XP.`}>
        {ticks.map((t) => (
          <SvgText
            key={`t${t}`}
            x={pad.l - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fontFamily={t === goal ? FONT.uiBold : FONT.ui}
            fill={t === goal ? c.text : c.muted}
          >
            {t}
          </SvgText>
        ))}
        {ticks
          .filter((t) => t !== goal && t !== 0)
          .map((t) => (
            <Line key={`g${t}`} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={c.benchDeep} strokeWidth={1} />
          ))}
        {days.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const on = i === active;
          return (
            <Rect
              key={`h${d.key}`}
              x={cx - band / 2}
              y={pad.t}
              width={band}
              height={plotH + pad.b}
              fill={on ? c.benchDeep : 'transparent'}
              opacity={on ? 0.6 : 1}
              onPress={() => setActive(on ? null : i)}
            />
          );
        })}
        {days.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const hgt = Math.max(0, y(0) - y(d.xp));
          const r = Math.min(4, hgt, barW / 2);
          const x0 = cx - barW / 2;
          const top = y(d.xp);
          const label = i === days.length - 1 ? 'hoje' : i % 2 === (days.length - 1) % 2 ? String(d.date.getDate()) : '';
          const met = d.xp >= goal;
          return (
            <PathGroup
              key={d.key}
              bar={hgt > 0 ? `M${x0} ${y(0)}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + barW - r}Q${x0 + barW} ${top} ${x0 + barW} ${top + r}V${y(0)}Z` : undefined}
              fill={met ? c.magenta : heat(c).cell(2)}
              label={label}
              lx={cx}
              ly={height - 8}
              color={c.muted}
              onPress={() => setActive(i === active ? null : i)}
            />
          );
        })}
        <Line x1={pad.l} x2={width - pad.r} y1={y(goal)} y2={y(goal)} stroke={c.text} strokeWidth={1.5} strokeDasharray="5 4" />
        <Line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke={c.rule} strokeWidth={2} />
      </Svg>
      {!any && (
        <Txt variant="small" tone="muted">
          Nenhum XP nestes dias ainda. Uma lição já aparece aqui.
        </Txt>
      )}
      <Text style={[styles.readout, { color: c.text }]}>
        {shown ? (
          <>
            <Text style={{ fontFamily: FONT.uiBold }}>{shown.xp} XP</Text> {dayName(shown.date)}, {shown.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            {shown.answered ? ` · ${shown.answered} questões` : ''}
          </>
        ) : (
          <>
            <Text style={{ fontFamily: FONT.uiBold }}>{days.reduce((s, d) => s + d.xp, 0)} XP</Text> em 14 dias
          </>
        )}
      </Text>
      <TableView head={['Dia', 'XP']} rows={days.map((d) => [d.date.toLocaleDateString('pt-BR'), String(d.xp)])} />
    </View>
  );
}

function PathGroup({ bar, fill, label, lx, ly, color, onPress }: { bar?: string; fill: string; label: string; lx: number; ly: number; color: string; onPress: () => void }) {
  return (
    <>
      {bar && <Path d={bar} fill={fill} onPress={onPress} />}
      {label ? (
        <SvgText x={lx} y={ly} textAnchor="middle" fontSize={11} fontFamily={FONT.ui} fill={color}>
          {label}
        </SvgText>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Reviews, weak spots, formats

function MiniTile({ id }: { id: string }) {
  const c = useTheme();
  const l = LESSON_BY_ID[id];
  return (
    <View style={[styles.mini, { backgroundColor: c.paper, borderColor: c.rule }]} accessibilityLabel={l?.title}>
      <Text style={[styles.miniText, { color: c.ink }]}>{l?.element.symbol}</Text>
    </View>
  );
}

function Forecast({ progress }: { progress: Progress }) {
  const c = useTheme();
  const days = reviewForecast(progress, 7);
  const total = days.reduce((s, d) => s + d.lessons.length, 0);
  if (!Object.keys(progress.completed).length) {
    return <Txt tone="muted">As revisões aparecem depois da primeira lição concluída.</Txt>;
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        {days.map((d, i) => {
          const has = d.lessons.length > 0;
          return (
            <View key={d.key} style={[styles.forecastRow, { borderBottomColor: c.benchDeep }]}>
              <Text style={[styles.forecastDay, { color: has ? c.text : c.muted }, has && { fontFamily: FONT.uiBold }]}>
                {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayName(d.date)}
              </Text>
              <Text style={[styles.forecastCount, { color: has ? c.magenta : c.muted }]}>{d.lessons.length || '–'}</Text>
              <View style={styles.forecastTiles}>
                {d.lessons.slice(0, 4).map((id) => (
                  <MiniTile key={id} id={id} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {days[0].lessons.length > 0 ? (
        <Btn kind="primary" label="Revisar agora" icon={(color) => <BoltIcon color={color} width={20} height={20} />} onPress={() => go({ name: 'review' })} />
      ) : (
        <Txt variant="small" tone="muted">
          {total ? 'Nada para hoje: aproveite para avançar na trilha.' : 'Nenhuma revisão nesta semana.'}
        </Txt>
      )}
    </View>
  );
}

function WeakSpots({ all, progress }: { all: Record<string, LessonMastery>; progress: Progress }) {
  const c = useTheme();
  const weak = weakSpots(all, 4);
  if (!weak.length) {
    const next = nextLesson(progress);
    return (
      <View style={{ gap: 12 }}>
        <Txt tone="muted">{Object.keys(progress.completed).length ? 'Nenhuma lição fraca agora. Continue revisando no tempo certo.' : 'Ainda não há lições praticadas.'}</Txt>
        {next && <Btn label={`Próxima lição: ${next.title}`} onPress={() => go({ name: 'lesson', id: next.id })} style={{ alignSelf: 'flex-start' }} />}
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {weak.map((m) => {
        const l = LESSON_BY_ID[m.id];
        return (
          <View key={m.id} style={styles.weak}>
            <MasteryTile symbol={l.element.symbol} level={m.level} size={40} />
            <View style={{ flex: 1 }}>
              <Txt variant="strong" numberOfLines={2}>
                {l.title}
              </Txt>
              <Txt variant="small" tone="muted">
                {pct(m.mastery)} · {LEVEL_LABEL[m.level].toLowerCase()}
              </Txt>
            </View>
            <Btn small label="Praticar" onPress={() => go({ name: 'lesson', id: m.id })} style={{ paddingHorizontal: 12 }} />
            <IconBtn
              label={`Treinar ${l.title} com o tutor`}
              style={{ backgroundColor: c.cobaltWash }}
              onPress={() => ask({ text: `Me ajuda a reforçar ${l.title.toLowerCase()}: explica o essencial e me testa.`, about: `Lição ${l.element.symbol}: ${l.title}`, open: true })}
            >
              <TutorIcon color={c.cobalt} />
            </IconBtn>
          </View>
        );
      })}
    </View>
  );
}

function KindBars({ progress }: { progress: Progress }) {
  const c = useTheme();
  const kinds = accuracyByKind(progress);
  if (!kinds.some((k) => k.tries)) return <Txt tone="muted">Responda algumas questões para ver seus acertos por formato.</Txt>;
  return (
    <View style={{ gap: 12 }}>
      {kinds.map((k) => (
        <View key={k.kind} style={styles.barRow}>
          <Text style={[styles.barLabel, { color: c.text }]} numberOfLines={2}>
            {KIND_LABEL[k.kind]}
          </Text>
          <Meter value={k.tries ? k.right / k.tries : 0} height={8} style={{ flex: 1 }} />
          <View style={{ minWidth: 64, alignItems: 'flex-end' }}>
            <Text style={[styles.barValue, { color: c.text, fontFamily: FONT.uiBold }]}>{k.tries ? pct(k.right / k.tries) : '–'}</Text>
            <Text style={[styles.kindN, { color: c.muted }]}>
              {k.tries} {k.tries === 1 ? 'questão' : 'questões'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8, paddingTop: 4 },
  goal: { marginTop: 20, gap: 8, padding: 16, borderRadius: 16, borderWidth: 2 },
  goalText: { gap: 2 },
  goalValue: { fontFamily: FONT.displayHeavy, fontSize: 30 },
  goalOf: { fontFamily: FONT.ui, fontSize: 17 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  kpi: { flexBasis: '47%', flexGrow: 1, gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2 },
  kpiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiLabelText: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  kpiValue: { fontFamily: FONT.displayHeavy, fontSize: 26 },
  kpiNote: { fontFamily: FONT.ui, fontSize: 12.5, lineHeight: 17 },
  kpiLink: { fontFamily: FONT.uiBold, fontSize: 16, textDecorationLine: 'underline', marginTop: 4 },
  panel: { marginTop: 18, gap: 16, padding: 14, borderRadius: 16, borderWidth: 2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  summaryText: { fontFamily: FONT.uiBold, fontSize: 14 },
  table: { borderTopWidth: 2, marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6, gap: 6 },
  th: { flex: 1, fontFamily: FONT.uiBold, fontSize: 12.5 },
  td: { flex: 1, fontFamily: FONT.ui, fontSize: 13 },
  first: { flex: 2 },
  overall: { justifyContent: 'center', alignItems: 'center' },
  overallValue: { fontFamily: FONT.displayHeavy },
  overallLabel: { fontFamily: FONT.uiBold, fontSize: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', columnGap: 10, rowGap: 2, paddingLeft: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontFamily: FONT.ui, fontSize: 11.5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 118, fontFamily: FONT.uiBold, fontSize: 13.5 },
  barValue: { minWidth: 40, textAlign: 'right', fontFamily: FONT.ui, fontSize: 13.5 },
  kindN: { fontFamily: FONT.ui, fontSize: 11 },
  sheetBody: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  fact: { flexBasis: '47%', flexGrow: 1, padding: 10, borderRadius: 12, borderWidth: 2, gap: 2 },
  sheetActions: { gap: 10, marginTop: 18 },
  calLabel: { fontFamily: FONT.ui, fontSize: 10.5 },
  calFoot: { gap: 8 },
  readout: { fontFamily: FONT.ui, fontSize: 14, lineHeight: 20 },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  forecastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, borderBottomWidth: 1 },
  forecastDay: { width: 76, fontFamily: FONT.ui, fontSize: 15, textTransform: 'capitalize' },
  forecastCount: { width: 22, fontFamily: FONT.uiBold, fontSize: 15, textAlign: 'center' },
  forecastTiles: { flexDirection: 'row', gap: 4, flex: 1 },
  mini: { width: 28, height: 28, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  miniText: { fontFamily: FONT.displayHeavy, fontSize: 13 },
  weak: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
