# Rarity tiers: proposal, not built

Nothing in the app does any of this yet. This is a proposal for the tier
scheme, plus a first pass at which existing lines belong where, so there is
something concrete to argue with. **Every assignment below needs your eye**,
picking what feels legendary is taste, and taste is the one part of this that
cannot be automated.

## Why rarity makes the pull better

A flat list of 766 lines has no peaks. Every notification is worth the same,
so none of them feel like anything. Tiers fix that in two ways:

- **The good ones get protected.** Right now your best lines fire as often as
  the filler, which burns them. A legendary that shows up once a fortnight
  keeps its punch.
- **The mediocre ones earn their keep.** Common lines become the baseline that
  makes a rare one land. You need the flat stretch to have a peak.

The Seen list already gives you the collection mechanic for free, it just has
nothing to collect yet. Tiers turn it into a set worth completing.

## Proposed tiers

| Tier | Share of list | Pull weight | Colour | Feel |
|---|---|---|---|---|
| Common | ~60% | 1.0 | Sage `#8A9A83` | The everyday texture. Fine, forgettable. |
| Rare | ~25% | 0.45 | Sage Light `#9BAA93` | A line you'd read twice. |
| Epic | ~10% | 0.18 | Sand `#D9CDB6` | Worth screenshotting. |
| Legendary | ~4% | 0.06 | Terracotta `#B3765C` | The ones that made you laugh out loud. |
| Mythic | ~1% | 0.015 | Cream `#F7F3EA` glow | Roughly one a month. Should feel like an event. |

A note on the colours: you suggested purple, yellow, green. Those read as a
game HUD, which fights the wellness-app disguise that makes the joke work
(BRAND.md: *"the wrapper is sincere, the content is not"*). The palette above
uses the brand's own ramp, ending at terracotta, the wilting petal, already
the accent for "this one is different". It stays sincere on the surface and
still gives you five distinguishable steps. If you want the loud version
anyway, say so; it's a one-line change.

## Where the colour should show

Not on the poster. A gold border around the quote breaks the deadpan
immediately. Suggested instead:

- A small dot or hairline next to each entry **in the Seen list**
- A one-word label under the wordmark **on the shared image**, legendary and
  above only
- Nothing at all in the notification

That way rarity is a thing you discover in your collection, not a thing the
app brags about.

## First-pass candidates

### Mythic: the ones that are genuinely strange

- `even something has meth in it.`
- `I C U P N I forgot what I had else to say.`
- `glow like the sun to plow like my son.`
- `you're as orange as a banana.`
- `the sun is hot.`
- `hm.`
- `imagine a pencis, heck, imagine two pencils.`

Yours, mostly. They are the least explicable lines in the list, which is
exactly what a top tier should be.

### Legendary: the ones with a real punchline

- `parents are like drugs, you flush them down the toilet when the cops arrive.`
- `the toaster remembers. the toaster always remembers.`
- `heard of H2O? now prepare for the upgrade H2O2.`
- `it's not 'bad smell' it's your alpha aura, keep going champ.`
- `did you try turning it off and on again? how about setting it on fire?`
- `while reading this you became an NPC, congratulations.`
- `a wall is a floor that refused.`
- `heard of sleep? try the premium version, unconsciousness.`
- `you have never lost an argument you were present for.`
- `productivity is just anxiety with a nicer font.`
- `insight is cheap. Tuesday is expensive.`
- `you're not blocked, you are comfortable, and those look identical from inside.`

### Epic: strong, reusable, quotable

- `today is a good day to start collecting jars.`
- `the walls are mad at you.`
- `your phone doesn't feel very comfy with everything it's seen.`
- `go outside and apologize to a tree, it knows what you did.`
- `water is just soup that gave up before it started.`
- `scientifically you're mostly bacteria wearing a hoodie.`
- `you have opened this app more times than you have opened a book.`
- `you have a plan B, which is plan A with more hoping.`
- `you were told this would happen. you were told twice. here we are.`
- `most of your problems are hypothetical and beautifully detailed.`
- `you have made a beautiful list of things that will not happen.`
- `nobody is going to tell you it is okay. it is okay. that changes nothing.`

### Common: everything else by default

Anything unassigned stays Common. That is the right default: it means adding a
quote requires no decision, and promoting one is a deliberate act.

## How to record it, when you want it built

Cheapest version that does not disturb anything: a single map of the
exceptions, since Common needs no entry.

```js
export const RARITY = {
  "even something has meth in it.": "mythic",
  "the toaster remembers. the toaster always remembers.": "legendary",
  // …only the non-common ones
};
```

Keyed by text, like the seen history and the notification payload already are,
so it survives edits to the list. Weighted pulls then need about fifteen lines
in `randomQuote()`, and the Seen list needs a coloured dot.

## Open questions for you

1. Brand palette above, or the loud purple/yellow/green?
2. Should rarity affect the **notification** pull, or only the in-app shuffle?
   Weighting notifications means your best lines reach people who never open
   the app, but it also means they burn faster.
3. Should the Seen list show how many of each tier remain? It makes it a
   collection, which is good for retention and bad for the joke's deadpan.
