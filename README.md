# CheMrster

ENEM chemistry from zero to hero: short, game-like lessons (pt-BR) where every
structure is drawn the way it would look printed in a textbook or on the exam itself.

```
npm install
npm run dev        # app at http://localhost:5173
npm test           # 152 tests: parser, perception, layout, stereo, drawing, ENEM parity, analysis, lessons
npm run build      # typecheck + production bundle
npm run sheet      # render every gallery molecule to PNG contact sheets in ./out
```

## What is in here

| Path | What it does |
| --- | --- |
| `src/nanquim/` | **Nanquim**, the 2D structure-drawing engine (no dependencies) |
| `src/chem/analysis.ts` | ENEM vocabulary computed from the graph: carbon classes, chain types, functional groups, chiral carbons, cis/trans capability, molar mass |
| `src/course/` | The organic chemistry track: units, lessons and seeded exercise generators |
| `src/content/molecules.ts` | ~75 molecules that keep showing up in ENEM questions |
| `src/app/` | React app: the lesson path, the lesson player and the *Estruturas* studio |

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
strung along a zig-zag like a skeletal formula. Thirteen lessons are playable today:

1. **O carbono e suas fórmulas**: tetravalence and hidden H, reading three kinds of formula, primary to quaternary carbons
2. **Cadeias carbônicas**: open/closed/branched, saturated/unsaturated, homogeneous/heterogeneous
3. **Hidrocarbonetos**: classes and IUPAC names
4. **Funções orgânicas**: oxygenated, nitrogenated and halides, and everyday ENEM molecules (aspirin, capsaicin…)
5. **Isomeria**: cis/trans and chiral carbons

Exercises are generated, not hand-keyed: each lesson draws from curated molecule pools and
asks the analysis module for the answer, so every replay is different and the answer key
cannot drift from the chemistry. Types: multiple choice, pick the structure, and tap the
atoms. Wrong answers come back at the end of the lesson, Duolingo-style. Progress, XP and
the daily streak live in `localStorage`.

## Known limits

- Bridged systems with substituents on the bridge (camphor, the N-methyl of cocaine) still
  overlap a little; a template library would fix the common ones.
- Units on reactions, polymers and biomolecules are on the path but not written yet.
- No AI tutor yet. The analysis module and the exercise format are the seam for it: an
  LLM can explain a wrong answer using the same group/atom data the generator used.
