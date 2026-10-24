# CheMrster: Nomenclatura do dia

A daily challenge on IUPAC nomenclature for the ENEM. Every day everyone gets the same eight
compounds: two **acids**, two **bases** and two **salts** as formulas, and two **organic
compounds** drawn as the exam prints them (condensed, or skeletal for rings and long chains, with a
button to switch), easier first. You type each one's IUPAC name on the keyboard, one answer per
compound:

| Shown | Answer |
| --- | --- |
| HClO | ácido hipocloroso |
| Fe(OH)₃ | hidróxido de ferro(III) |
| NaHCO₃ | hidrogenocarbonato de sódio |
| H₃C–CH(OH)–CH₃ | propan-2-ol |
| H₃C–COO–CH₂–CH₃ | etanoato de etila |

Typing is forgiving where it does not matter. Accents, capitals, hyphens and spaces are ignored,
the charge can be written ferro(III), ferro (III) or ferro III, and organic names can follow
today's style or the older one still in many books (propan-2-ol or 2-propanol, buta-1,3-dieno or
1,3-butadieno). Typing a traditional, popular or usual name of the compound (sulfato férrico,
soda cáustica, acetona) does not spend the answer: the app asks for the IUPAC name and you try
again.

After each answer the app explains the name: for inorganic compounds, from the formula (the
oxidation number and the hipo…oso / …ico / per…ico series, the charges that give the Roman numeral,
the acid an anion comes from); for organic ones, from the structure (the function and its suffix,
the main chain's prefix, an/en/in, how to number, the branches in alphabetical order); and the
other names in use. After the last one, the day's summary shows the score, the streak
(consecutive days completed), every answer to review, and the countdown to the next challenge at
local midnight.

Around the challenge:

- **Treino:** unlimited practice, by function and difficulty. It does not count in the statistics.
- **Guia:** the naming rules (inorganic and organic) and the tables of every ion in the app.
- **Estatísticas:** challenges completed, hit rate, streak and record, and hit rate by function.
- **Ajustes:** the theme.

Everything is in Portuguese and saved on the device.

```
cd mobile
npm install
npx expo start            # Metro; open with a development build (npx expo run:android) or press w for the web
npm run typecheck         # the app and the shared code it imports
npm run bundle            # the Android JavaScript bundle, as a check
npx expo export --platform web --output-dir web-build
                          # a static web build of the same app
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
| `../src/nomenclatura/pieces.ts` | The parts of names (prefixes, element roots, suffixes, cations, Roman numerals) and how they spell a word (tio + sulfato = tiossulfato) |
| `../src/nomenclatura/catalog.ts` | ~300 compounds with their IUPAC, traditional and everyday names, tiers and facts; base and salt formulas are built from their ions |
| `../src/nomenclatura/organic.ts` | The organic compounds (SMILES), and their names written from parts: branches, chain, an/en/in, suffix, locants, in today's and the older style |
| `../src/nomenclatura/check.ts` | Checks a typed name: what is ignored, and the nudge for traditional and popular names |
| `../src/nomenclatura/explain.ts` | Why each compound has its name, from its formula |
| `../src/nomenclatura/daily.ts` | Challenge numbers by local date, the day's compounds (six until challenge #2, eight with the organic ones from #3; no repeats until a pool runs out, never two days in a row), practice picks |
| `../src/nomenclatura/play.ts`, `store.ts` | Saved answers and statistics |

The app holds the screens:

| Path | What it does |
| --- | --- |
| `app/` | Routes (Expo Router): the tabs *Hoje*, *Treino* and *Guia* |
| `src/screens/` | The three screens; *Hoje* also holds the day's summary |
| `src/game/` | The question (formula or structure, typed answer, result and explanation), the structure drawing (Nanquim, `../src/nanquim`, in react-native-svg), the sheets (how it works, statistics, preferences) and the midnight clock |
| `src/ui/` | The UI kit: text, buttons, cards, sheets, icons, the top bar, toasts |
| `src/prefs.ts`, `src/theme.ts` | The theme preference and the palette |
| `metro.config.js` | Watches `../src` and resolves its packages from this folder, so there is one React |
| `index.ts` | Installs `localStorage` from `expo-sqlite` (Android) before the stores load |

## Adding compounds

Add a line to `ACID_DEFS`, `BASE_DEFS` or `SALT_DEFS` in `../src/nomenclatura/catalog.ts`, or to
`ORGANIC_DEFS` in `../src/nomenclatura/organic.ts` (its SMILES and the parts of its name). The tests
check that each name spells right, that no two compounds share a name, that every oxyacid's
suffix matches the oxidation number of its formula, and that every organic name's parts (function,
carbons, double and triple bonds) match its structure. Days already played keep the compounds they
were played with. Changing a pool reshuffles the days that use it, so add compounds before launch
or accept that future days change.
