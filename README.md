# CheMrster

ENEM chemistry from zero to hero: short, game-like lessons (pt-BR) where every
structure is drawn the way it would look printed in a textbook or on the exam itself.

```
npm install
npm run dev        # app at http://localhost:5173
npm test           # 458 tests: parser, layout, drawing, ENEM parity, analysis, reactions, lessons, theory, review
npm run build      # typecheck + production bundle
npm run sheet      # render every gallery molecule to PNG contact sheets in ./out
```

## What is in here

| Path | What it does |
| --- | --- |
| `src/nanquim/` | **Nanquim**, the 2D structure-drawing engine (no dependencies) |
| `src/chem/analysis.ts` | ENEM vocabulary computed from the graph: carbon classes, chain types, functional groups, chiral carbons, cis/trans capability, molar mass |
| `src/chem/graph.ts` | SMILES writer (keeps @/@@ and cis/trans), canonical keys ("is this the same substance?"), symmetry classes, and `Draft`, an editable molecule |
| `src/chem/reactions.ts` | The ENEM reactions as graph edits: additions (Markovnikov), substitution (alkanes, benzene directors), oxidation, combustion, esters, saponification, biodiesel, polymers, peptides, glycosides |
| `src/course/` | The track: units, lessons, theory cards, seeded exercise generators, spaced review and the studio's reaction lab |
| `src/content/molecules.ts` | ~75 molecules that keep showing up in ENEM questions |
| `src/app/` | React app: the lesson path, theory and practice, daily review, and the *Estruturas* studio |

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
- No AI tutor yet. The analysis module, the reaction engine and the exercise format are the
  seam for it: an LLM can explain a wrong answer using the same data the generator used.
