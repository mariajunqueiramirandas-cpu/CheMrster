# CheMrster

ENEM chemistry from zero to hero: short, game-like lessons (pt-BR) where every
structure is drawn the way it would look printed in a textbook or on the exam itself,
with an AI tutor that checks its chemistry against the same engine that grades the
exercises, a progress tracker, a study board and an infinite concept map.

```
npm install
npm run dev        # app at http://localhost:5173
npm test           # 511 tests: drawing, chemistry, lessons, review, progress, board, canvas, tutor, proxy
npm run build      # typecheck + production bundle
npm run serve      # serve ./dist with the tutor's API proxy (after npm run build)
npm run sheet      # render every gallery molecule to PNG contact sheets in ./out
```

To turn on the AI tutor, either put `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local` (or the
environment) before `npm run dev` / `npm run serve`, so the key stays on the server, or paste
a key in *Ajustes* inside the app, where it stays on that device. Without a key the tutor
still works offline from the course's own content.

## What is in here

| Path | What it does |
| --- | --- |
| `src/nanquim/` | **Nanquim**, the 2D structure-drawing engine (no dependencies) |
| `src/chem/analysis.ts` | ENEM vocabulary computed from the graph: carbon classes, chain types, functional groups, chiral carbons, cis/trans capability, molar mass |
| `src/chem/graph.ts` | SMILES writer (keeps @/@@ and cis/trans), canonical keys ("is this the same substance?"), symmetry classes, and `Draft`, an editable molecule |
| `src/chem/reactions.ts` | The ENEM reactions as graph edits: additions (Markovnikov), substitution (alkanes, benzene directors), oxidation, combustion, esters, saponification, biodiesel, polymers, peptides, glycosides |
| `src/course/` | The track: units, lessons, theory cards, seeded exercise generators, spaced review and the studio's reaction lab |
| `src/content/molecules.ts` | ~75 molecules that keep showing up in ENEM questions |
| `src/tutor/` | The AI tutor: system prompt with the whole course, learner context, tools backed by the chemistry engine, the streaming tool-use loop, its markup, and the offline tutor |
| `src/study/` | Learning models: mastery with a forgetting curve, the study calendar and review forecast, the kanban board, and the concept-map canvas with its geometry |
| `server/anthropic-proxy.ts` | Forwards the Messages API to Anthropic with the server's key, for `dev`, `preview` and `serve` |
| `src/app/` | React app: the lesson path, theory and practice, daily review, the *Estruturas* studio, the tutor, *Mapa*, *Quadro*, *Progresso* and *Ajustes* |

## Nanquim: structures that look printed

`renderSVG('CC(=O)Oc1ccccc1C(=O)O')` returns a standalone SVG of aspirin. Under the hood:

- **SMILES parser** (OpenSMILES): organic subset, bracket atoms, charges, isotopes,
  `@`/`@@`, `/` `\`, ring closures incl. `%nn`, dot-disconnected salts. Errors are in
  Portuguese with the position.
- **Perception**: SSSR rings (Horton + GF(2) elimination), kekulisation of aromatic input,
  implicit hydrogens, cis/trans requirements from bond directions.
- **Layout** tuned for textbook conventions: fused rings tiled from regular polygons
  (naphthalene, phenanthrene, benzo[a]pyrene, steroids in their classic pose), bridged
  bicyclics drawn as an outline plus bridges, 120° zig-zag chains, straight sp carbons,
  cis/trans honoured while placing, overlaps removed by mirroring branches, and a final
  orientation chosen on a 30°/60° grid (functional groups to the right, carbonyl O up,
  small fused rings to the upper right).
- **Depiction** following the ACS 1996 journal settings: hairline bonds, double bonds
  offset into rings with the inner stroke trimmed to the inner polygon, centred C=O whose
  strokes meet the neighbouring bonds exactly, triple bonds, wedge/hash stereo bonds
  derived from `@`/`@@`, labels typeset with Helvetica metrics (OH vs HO, NH₂ vs H₂N, H
  above/below ring NH), sub/superscripts for counts, charges and isotopes, and bonds
  clipped against the glyph outlines.
- Four formula styles for the "zero to hero" path: `skeletal` (bastão), `condensed`
  (H₃C–CH₂–OH with straight chains), `plana` (ENEM's fórmula estrutural plana) and
  `structural` (every H drawn).
- Styles: `enem` (the printed exam, see below), `textbook` (screen), `acs` (journal print)
  and `card`. All lengths are relative to the bond length, so drawings scale without
  changing proportions.
- **Polymers**: with `polymer: true`, a repeat unit written with two `*` ends
  (`*CC(*)Cl`) is drawn as textbooks do: the chain levelled between the ends, square
  brackets crossing the end bonds and a subscript *n*, in every formula style.

### ENEM parity

`depict(smiles, { style: 'enem', conventions: 'enem' })` draws structures the way the INEP
booklets print them. The numbers were measured on ENEM 2023, question 134, rendered at
600 dpi: bond 15.6 pt, stroke 0.72 pt (0.046 of the bond), inner double-bond offset 2.76 pt
(18%), Arial 9.75 pt labels and Arial Bold names. The conventions come from the 2021–2025
booklets:

| Convention | Seen in |
| --- | --- |
| Aldehyde H drawn (O=C–H); open-chain N–H drawn as a bond | 2022 Q102, 2023 Q134, 2024 Q112 |
| CH₃ written on O/S-methyls, terminal =CH₂ and methyls on C=C | 2022 Q102, 2024 Q112 |
| Ring with one group (or two, ortho/meta) stands upright, group on top, C=O up-left | 2022 Q102, 2024 Q96 |
| Para rings rise to the right at 30°, larger group on the right | 2022 Q102, 2023 Q134 |
| Counter-ion set beside the charge: "O⁻ Na⁺" | 2023 Q134 |
| Bold name centred under the structure, source line under it | 2022 Q102, 2023 Q134 |
| Groups marked with dashed outlines and a bold name (`annotations`) | 2024 Q112 |
| `formula: 'plana'`: HS–C–C–COOH with CH₃/NH₂/COOH condensed and C–H drawn | 2022 Q93 |
| Condensed groups `abbreviations: ['COOH', 'NO2', ...]`, written HOOC/O₂N leftwards | 2022 Q93, 2024 Q96 |

The booklets mix authors and tools (Illustrator artwork, some ACD/ChemSketch files), so
not every question follows every rule; these are the majority conventions.
`src/nanquim/enem.test.ts` pins each one.

`depict()` returns positioned primitives instead of a string, which the app renders as
native SVG elements: structures inherit theme colours, atoms can be tapped, and new
molecules are inked in bond by bond.

## The course

Every structure in the app uses the ENEM look, so students practise on the drawings they
will see on exam day; groups being asked about get the booklets' dashed outline.

Lessons are tiles on a periodic table: lesson *n* sits on element *n* and the tiles are
strung along a zig-zag like a skeletal formula. All twenty lessons, hydrogen to calcium,
are playable:

1. **O carbono e suas fórmulas**: tetravalence and hidden H, reading three kinds of formula, primary to quaternary carbons
2. **Cadeias carbônicas**: open/closed/branched, saturated/unsaturated, homogeneous/heterogeneous
3. **Hidrocarbonetos**: classes and IUPAC names
4. **Funções orgânicas**: oxygenated, nitrogenated and halides, and everyday ENEM molecules (aspirin, capsaicin…)
5. **Isomeria**: cis/trans and chiral carbons
6. **Reações orgânicas**: addition and Markovnikov, substitution in alkanes and benzene (orto/para vs meta), oxidation of alcohols and combustion balancing, esterification, ester names, scents and hydrolysis
7. **Polímeros e biomoléculas**: addition vs condensation polymers (PE to PET, nylon, Kevlar, PLA), fats, soaps, saponification and biodiesel, amino acids, peptide and glycosidic bonds, aldoses and ketoses

**Teach, then practise.** Each lesson opens with two to four theory cards: short text with
the key terms in bold, drawings (reaction schemes with reagents over the arrow, outlined
groups, marked ring positions) and a line on how the ENEM asks about it. Students can skip
them, step back, or reread any lesson's theory as one page (`#/teoria/<id>`).

**Generated exercises.** Each lesson draws from curated molecule pools and asks the
analysis module or the reaction engine for the answer, so every replay is different and the
answer key cannot drift from the chemistry. Distractors are the classic mistakes, also
computed: the anti-Markovnikov product, the wrong ring position, over-oxidation, the ester
read backwards, the polymer that keeps its double bond. Options are compared by canonical
key, so two drawings of the same substance never appear as different answers. Types:
multiple choice, pick the structure, and tap the atoms. Wrong answers come back at the end
of the lesson.

**Spaced review.** Every completed lesson sits in a Leitner box and comes back after 1, 2,
4, 8 or 16 days: up a box after a good review, back to the first after a bad one. The daily
review (`#/revisao`) mixes a few fresh questions from each due lesson, interleaved.
Progress, XP, the daily streak and the review schedule live in `localStorage`.

**Reaction lab.** In *Estruturas*, any structure you type gets the reactions that apply to
it (hydrogenation, Markovnikov additions, oxidation, esterification, saponification,
nitration with the right director, polymerization, balanced combustion), with the computed
product one tap away from the editor.

## The tutor

A tutor button sits on every screen (Ctrl/⌘ + K), and the tutor is woven into the course:
**Dica** on a question gives a nudge without the answer, **Por que errei?** after a verdict
explains the miss, **Explicar de outro jeito** re-explains a theory card, and the studio asks
about the structure on screen. Each message carries what is on screen (the question and the
learner's answer, the card, the molecule) and a snapshot of the learner's progress.

With the Claude API (Claude Opus 5.5 by default; Sonnet 5.5 or Haiku 5.5 in *Ajustes*) the
tutor streams its answers and uses tools that run in the browser:

| Tool | What it does |
| --- | --- |
| `analisar_molecula` | Formula, molar mass, chain, functions, chiral carbons and cis/trans from `src/chem/analysis.ts` |
| `reagir` | The ENEM reactions that apply to a structure, with products from `src/chem/reactions.ts` |
| `propor_exercicio` | A fresh question from a lesson's generator, answered inside the chat and logged to progress |
| `salvar_no_mapa` | A hub-and-spokes cluster of concept cards with labelled arrows on the map |
| `planejar_tarefas` | Cards on the study board, linked to lessons where they match |

So the tutor never has to guess a formula or a product. It writes structures as
`<mol smiles="..."/>`, which the app draws ENEM-style, and links lessons as `[[licao:id]]`.
The system prompt holds the whole course (outline and every theory card) and is prompt-cached;
history is replayed exactly, including thinking blocks; tool inputs stream eagerly and are
validated before anything runs; turns cut off by `max_tokens` or a refusal never run tools;
server-side fallbacks are on for Opus and Sonnet. Created cards and tasks can be undone from
the chat.

Without a connection the **offline tutor** answers from the course: a missed question gets
its key, explanation and the theory card behind it; a molecule (by name or SMILES) gets the
engine's analysis; "me testa em…" gets a generated question; "monta um plano" fills the board;
anything else is matched against the theory cards.

## Progress

Every answer is logged (lesson, format, first try or retry, time). A lesson's **mastery** is
its recent first-try accuracy (smoothed while there is little evidence) times how much is
still remembered, from the FSRS power-law forgetting curve with the Leitner box as stability:
90% on the review date, fading slowly after. *Progresso* shows it as a main-group periodic
table (H to Ca, one element per lesson) filled by a validated one-hue ramp, with unit bars, a
study calendar against the daily goal, XP by day, the week's review forecast, weak spots and
accuracy by question format; every chart has a table view and keyboard access.

## Study board

*Quadro* is a kanban (A estudar, Estudando with a soft limit of three, Revisar, Dominado).
Cards drag with a mouse, with a finger after a long press, or with Alt + arrows, and open an
editor with lesson link, due date, colour, notes and a checklist. Cards linked to a lesson move
by themselves: after practice to *Dominado* or *Revisar*, and back to *Revisar* when the lesson
comes due. *Lições da trilha* fills the board with due reviews and the next lessons; the tutor
can plan a week on it.

## Concept map

*Mapa* is an infinite canvas of paper cards on a dotted notebook bench: notes, structures,
theory cards from the course, tutor answers and saved questions (every theory card, studio
structure, verdict and tutor reply has a *Salvar no mapa* button). Pan by dragging or with the
wheel, zoom with Ctrl + wheel, a trackpad pinch or two fingers; select, marquee-select with
Shift, move, duplicate, recolour; drag a selected card's dot onto another card to link them.
Links are drawn like reaction arrows with the label written over them, as reagents are. Several
maps, undo/redo, a minimap, and *Expandir* to let the tutor grow a card into a cluster.

Everything a learner makes lives in `localStorage`; *Ajustes* exports and restores it as JSON.

## Known limits

- Bridged systems with substituents on the bridge (camphor, the N-methyl of cocaine) still
  overlap a little; a template library would fix the common ones.
- The reaction engine follows the textbook rules (Markovnikov, Zaitsev, ring directors,
  terciário > secundário > primário for bromination); it does not model carbocation
  rearrangements, and the pools avoid substrates where they matter.
- Canonical keys ignore stereochemistry, and disaccharides are drawn without it, so maltose
  and lactose would look the same; only sucrose and maltose are used.
- Full triglycerides with three long chains still lay out with one tail hanging down; the
  lessons draw them with R groups, as textbooks do.
- Data stays on one device; there is no account or sync beyond the JSON backup.
- `npm run serve` lets anyone who can open the page use the server's API key: put it behind
  your own login before exposing it to the internet.
