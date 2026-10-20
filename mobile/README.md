# CheMrster for Android

The CheMrster course as a native Android app, written in React Native with [Expo](https://expo.dev)
(SDK 58, React Native 0.88, Expo Router). The app shares the web app's engine instead of
copying it. Nanquim, the chemistry, the course and its exercise generators, the tutor, and the
stores for progress, board, map and settings all come from `../src`. A question generated on
the phone is graded by the same code as on the web, and a backup made in one app restores in
the other.

```
cd mobile
npm install
npx expo start            # Metro; open with a development build (npx expo run:android)
npm run typecheck         # the app and the shared code it imports
npm run bundle            # the Android JavaScript bundle, as a check
npx expo prebuild --platform android && (cd android && ./gradlew assembleRelease)
                          # android/app/build/outputs/apk/release/app-release.apk
```

Every push that touches `mobile/` or `src/` builds the APK on GitHub Actions
(`.github/workflows/android.yml`). Download it from the run's artifacts and install it on a phone
(allow installs from unknown sources). That APK is signed with the debug key, so it is fine for
testing but not for the Play Store: for a store build, use `npx eas-cli build -p android` or
configure a release keystore.

## How it fits together

| Path | What it does |
| --- | --- |
| `app/` | Routes (Expo Router): the tabs *Trilha*, *Mapa*, *Tutor*, *Quadro*, *Mais*; lessons and the review slide up over them; theory, *Estruturas*, *Progresso* and *Ajustes* open on top |
| `src/screens/` | The screens, ported from `../src/app/screens` with the same copy and behaviour |
| `src/ui/` | The UI kit: the theme's text, buttons and paper, the icon set, `MoleculeView` (Nanquim drawings with react-native-svg, inked in bond by bond, atoms tappable), schemes, theory cards, sheets |
| `src/tutor/`, `src/canvas/`, `src/board/`, `src/progress/`, `src/studio/`, `src/settings/` | Each section's own components |
| `src/lib/nav.ts` | The web app's hash routes (`#/mapa`, a toast's link) mapped to the app's screens |
| `metro.config.js` | Watches `../src` and resolves its packages from this folder, so there is one React |
| `index.ts` | Installs `localStorage` from `expo-sqlite` before the stores load |

## What carries over, and what differs

- **Saved on the phone.** Progress, reviews, board, map, tutor conversations and settings persist in
  SQLite through the same `localStorage` keys the web app uses. *Ajustes* exports and imports the
  same backup file as the web app.
- **The tutor.** It works offline from the course's own content with no setup. With an Anthropic API
  key in *Ajustes* it answers with Claude, streaming, with the same tools (analysis, reactions,
  questions, map and board). The key stays on the device. To use a CheMrster server's key instead,
  build with `EXPO_PUBLIC_API_URL=https://your-server` (a server without accounts; signing in from
  the app is not built yet).
- **Not in the app yet:** accounts (Clerk), sync between devices and the *Pro* plan. Those need a
  native sign-in flow. Until then, the backup file moves data between the web and the phone.
- **Feels like Android.** It has the system back gesture (lessons ask before throwing away a session),
  haptics on answers, edge-to-edge drawing under the status and navigation bars, dark mode
  following the system (or *Ajustes*), and reduced motion respected.
