# CheMrster: Nomenclatura do dia

A daily nomenclature challenge for the ENEM, in the spirit of Wordle. Every day everyone gets the
same three compounds, an **acid**, a **base** and a **salt**, shown as formulas. You build each
one's IUPAC name from its pieces, the way Brazilian textbooks teach it:

| Kind | Slots | Example |
| --- | --- | --- |
| Ácido | prefixo · radical · sufixo | HClO → *hipo · clor · oso* → ácido hipocloroso |
| Base | cátion · carga | Fe(OH)₃ → *ferro · III* → hidróxido de ferro(III) |
| Sal | prefixo · radical · sufixo · de · cátion · carga | NaHCO₃ → *hidrogeno · carbon · ato* de *sódio* |

Prefix and charge may stay empty (dashed slots). Each guess turns over slot by slot:

- 🟩 **certo**: the right piece, or an empty slot that should be empty.
- 🟨 **quase**: a piece of the same family, but not this one (-ito for -ato, II for III, per- for hipo-).
- ⬛ **errado**: the wrong piece, or a slot left empty that needed one.

There are six tries per compound. After each one the game explains the name from the formula: the
oxidation number and the hipo…oso / …ico / per…ico series, the charges that give the Roman
numeral, the acid an anion comes from, and the traditional and everyday names (sulfato férrico,
bicarbonato). The week ramps up: Monday and Tuesday are easy, midweek medium, the weekend hard. A
new puzzle opens at local midnight.

Around the game:

- **Statistics:** days played, hit rate, streak and record, tries per hit, and hit rate by function.
- **Sharing:** the result goes out as squares, with no names, so it spoils nothing.
- **Treino:** unlimited practice, by function and difficulty. It does not count in the statistics.
- **Guia:** the rules, and the tables of every ion in the game.
- **Ajustes:** light/dark theme and a high-contrast palette (orange and blue).
- **On the web:** a physical keyboard works (Enter sends, Backspace deletes).

Everything is in Portuguese and saved on the device.

```
cd mobile
npm install
npx expo start            # Metro; open with a development build (npx expo run:android) or press w for the web
npm run typecheck         # the app and the shared code it imports
npm run bundle            # the Android JavaScript bundle, as a check
npx expo export --platform web --output-dir web-build
                          # a static web build of the same game
npx expo prebuild --platform android && (cd android && ./gradlew assembleRelease)
                          # android/app/build/outputs/apk/release/app-release.apk
```

Every push that touches `mobile/` or `src/` builds the APK on GitHub Actions
(`.github/workflows/android.yml`). Download it from the run's artifacts and install it on a phone
(allow installs from unknown sources). That APK is signed with the debug key, so it is fine for
testing but not for the Play Store: for a store build, use `npx eas-cli build -p android` or
configure a release keystore.

## How it fits together

The rules live in `../src/nomenclatura/` (no React Native in there), tested with the rest of the
shared code by `npm test` at the repository root:

| Path | What it does |
| --- | --- |
| `../src/nomenclatura/pieces.ts` | The pieces (prefixes, element roots, suffixes, cations, Roman numerals), the slots of each kind of name, and how pieces spell a word (tio + sulfato = tiossulfato) |
| `../src/nomenclatura/catalog.ts` | ~200 compounds with tiers and facts; base and salt formulas are built from their ions |
| `../src/nomenclatura/grade.ts` | Wordle-style grading slot by slot, accepted alternatives (ortofosfato), the keyboard's colours |
| `../src/nomenclatura/explain.ts` | Why each compound has its name, from its formula |
| `../src/nomenclatura/daily.ts` | Puzzle numbers by local date, the day's trio (no repeats until a pool runs out), practice picks |
| `../src/nomenclatura/play.ts`, `store.ts` | Saved games, statistics, streaks and the text to share |

The app holds the screens:

| Path | What it does |
| --- | --- |
| `app/` | Routes (Expo Router): the tabs *Hoje*, *Treino* and *Guia* |
| `src/screens/` | The three screens |
| `src/game/` | The round (formula, board, keyboard, result), the flipping tiles, the sheets (how to play, statistics, preferences), the midnight clock and sharing |
| `src/ui/` | The UI kit: text, buttons, cards, sheets, icons, the top bar, toasts |
| `src/prefs.ts`, `src/theme.ts` | Theme and contrast preferences; the palette and the tile colours |
| `metro.config.js` | Watches `../src` and resolves its packages from this folder, so there is one React |
| `index.ts` | Installs `localStorage` from `expo-sqlite` (Android) before the stores load |

## Adding compounds

Add a line to `ACID_DEFS`, `BASE_DEFS` or `SALT_DEFS` in `../src/nomenclatura/catalog.ts`. The tests
check that each name spells right, that every oxyacid's suffix matches the oxidation number of its
formula, and that every answer can be typed on the keyboard. Puzzles already played keep the
compound they were played with. Changing a pool reshuffles the days that use it, so add
compounds before launch or accept that future days change.
