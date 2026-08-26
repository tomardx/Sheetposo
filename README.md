# Sheetposo

A joke app, InspiroBot-style. It fires random local notifications throughout the
day with absurd, deadpan "motivational" quotes. Tapping a notification opens a
fullscreen poster with that exact quote over a randomly generated abstract
background. Fully local and offline, no backend, no accounts, no analytics.

## How it works

- **One screen**: the poster. A quote in big impact-style text over a
  procedurally generated gradient/shape background. The Shuffle button picks a
  new random quote and background pairing.
- **Seen**: a button opening a sheet listing only the quotes this user has
  actually been shown, on the poster or delivered to the notification tray.
  The rest of the list is deliberately unreachable from the UI; unseen quotes
  stay a surprise. History is stored as text (not indexes) in AsyncStorage, so
  it survives edits to the quote list.
- **What's new?**: a small control in the top-right opening the patch notes
  from `patchNotes.js`. Rendered outside the capture layer, so it never lands
  in a shared image.
- **Sharing**: Share renders the poster to a 1080x1080 PNG via
  `react-native-view-shot` and opens the native share sheet. Image only, no
  caption or link. Square because chat apps crop tall images in the message
  preview, which cut off the watermark. The poster is rendered twice: a
  branded capture layer sits behind the visible one, so the lotus watermark
  appears only in the shared image and never flashes on screen.
- **Notifications**: on launch the app requests notification permission, then
  schedules 3 to 8 notifications per day at random times between 8am and 11pm,
  for today and the next six days. Times are picked one per evenly sized slot
  so they cannot cluster. Opening the app on a new calendar day re-rolls the
  entire schedule. Tapping a notification opens the poster showing that exact
  quote.
- **Data**: 766 quotes bundled in `quotes.js`. Backgrounds are generated
  in-app (`backgrounds.js`), no image assets needed.

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
`extra.eas.projectId` to `app.json`), accept the prompts. The resulting APK is
sideloadable; no Play Store involved.

## Project layout

- `App.js`: the poster screen, the sheets, and notification-tap handling
- `quotes.js`: the quote list, plus `formatQuote()`
- `patchNotes.js`: release notes shown by the "What's new?" sheet
- `backgrounds.js`: procedural background definitions (gradients and shapes)
- `notifications.js`: permission handling and daily random scheduling
- `seenQuotes.js`: seen history and the delivered-notification log
- `ErrorBoundary.js`: catches render crashes and shows the error
- `app.config.js`: drops the Play-restricted permission from production builds
- `tools/make_bleep.py`: regenerates the notification sound

## Adding quotes

1. **Punctuate properly.** Apostrophes in contractions, commas where a
   sentence needs them, and a full stop, question mark, or exclamation mark at
   the end.
2. **Start the line lowercase.** `formatQuote()` capitalises the opening
   letter and the start of every sentence after it, wherever a quote is shown:
   the poster, the seen list, and the notification body. The list never needs
   hand-casing and cannot drift out of sync between those places. Deliberate
   mid-line capitals are preserved.
3. **No em dashes.** See `CLAUDE.md`.
4. **Aim at the reader.** Witty, cynical, demotivational. The joke usually
   lands on whoever is reading, implied rather than stated. Never a direct
   insult.

Bump `QUOTES_VERSION` after any substantial edit so already-scheduled
notifications are re-rolled instead of delivering stale text.
