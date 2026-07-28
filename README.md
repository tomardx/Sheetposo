# Sheetposo

A joke app, InspiroBot-style. It fires random local notifications throughout the
day with absurd, deadpan "motivational" quotes. Tapping a notification opens a
fullscreen poster with that exact quote over a randomly generated abstract
background. Fully local and offline — no backend, no accounts, no analytics.

## How it works

- **One screen**: the poster. A quote in big impact-style text over a
  procedurally generated gradient/shape background. The 🔀 Shuffle button picks
  a new random quote + background pairing.
- **Sharing**: two icon buttons under Shuffle. Share renders the poster to a
  PNG via `react-native-view-shot` and opens the native share sheet — image
  only, no caption or link. Copy puts the bare quote text on the clipboard.
  The poster is rendered twice: a branded capture layer sits behind the
  visible one, so the lotus watermark appears only in the shared image and
  never flashes on screen.
- **Notifications**: on launch the app requests notification permission, then
  schedules a random number of notifications (3–8 per day) at random times
  between 8am and 11pm, for today and the next 3 days. Opening the app on a new
  calendar day re-rolls the entire schedule. Tapping a notification opens the
  poster showing that exact quote.
- **Data**: ~500 quotes bundled in `quotes.js`. Backgrounds are generated
  in-app (`backgrounds.js`) — no image assets needed.

## Development

```bash
npm install
npx expo start
```

## Building the APK

```bash
eas build --platform android --profile preview
```

The first run of `eas build` will link the project to an EAS project (adds
`extra.eas.projectId` to `app.json`) — accept the prompts. The resulting APK is
sideloadable; no Play Store involved.

## Project layout

- `App.js` — the poster screen and notification-tap handling
- `quotes.js` — the quote list (append-only: notifications reference quotes by index)
- `backgrounds.js` — procedural background definitions (gradients + shapes)
- `notifications.js` — permission handling and daily random scheduling
