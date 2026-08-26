# Rarity tiers

Shipped in 1.1.0. This describes what the app actually does and how to change
it. The tiers live in `rarity.js`.

## The tiers

Commonest first. `share` is the chance of the **tier** being drawn, not of any
one quote in it.

| Tier | Share | Turns up | Colour | Motion |
|---|---|---|---|---|
| Super ultra mega common | 46% | constantly | `#8A9A83` sage | none |
| Embarrassingly common | 24% | ~17 hours | `#8A8578` warm grey | none |
| Sooo uncommon | 16% | daily | `#6E8F8A` dusty teal | breath |
| Somewhere between rare and legendary | 8.5% | 2 days | `#7B7FA8` blue-violet | breath + sweep |
| So rare it still moos | 3.5% | 5 days | `#B3765C` terracotta | breath + sweep |
| Legendary (unverified) | 1.5% | 11 days | `#A8841B` gold | full, plus sound |
| fish | 0.5% | ~monthly | `#2E8B93` deep teal | full, plus sound |

"Turns up" assumes about six notifications a day.

## How a pull works

Pick a tier by its `share`, then a quote uniformly inside that tier. Empty
tiers are skipped and the remaining shares renormalised.

Per-quote weights were tried first and do not work at this list size: 670-odd
common lines swamped everything and left `fish` at 0.01%, once every four
years. Tier shares stay predictable however the list grows.

## Where rarity shows up

- **Poster**: the gradient is the tier's. From "somewhere between rare and
  legendary" upward the tier name appears under the quote; below that, nothing.
- **Motion**: scales with the tier. The two common tiers are completely still,
  which is what makes a rare pull obvious before you read anything. Frozen on
  the capture layer so a share cannot catch a half-faded frame.
- **Notification**: `content.color` tints the tray, so a rare one is visible
  before it is opened.
- **Sound**: the two rarest tiers use `legendary.wav` on their own channel.
  Android freezes a channel's sound at creation, so a second channel is the
  only way to have two sounds.
- **Seen**: each row carries its tier colour and label, and the chip row
  filters by tier. Only tiers already collected are offered, so the filter
  never leaks what is still out there.

## Changing it

Promote a quote by adding it to `RARITY` in `rarity.js`, keyed by its exact
text:

```js
export const RARITY = {
  "the toaster remembers. the toaster always remembers.": "unverified",
};
```

Anything unlisted is common, so adding a quote needs no decision and promoting
one is deliberate. Unlisted quotes split between the two common tiers by a
stable hash of the text, which keeps both populated without curating several
hundred lines.

Keys are text, like the seen history and the notification payload, so they
survive edits to the quote list. A key that no longer matches a live quote is
invisible in the app: the quote just stays common. There is a test for exactly
that, because it had already happened once.

Tests also pin the tier invariants: shares descend and sum to one, motion never
decreases, colours are distinct, no tier is empty, and the measured pull
distribution matches the table above.

## Still open

1. Rarity currently weights **notifications** as well as the in-app shuffle.
   That means the best lines reach people who never open the app, at the cost
   of burning through them faster. Worth revisiting once there is usage.
2. The Seen sheet does not show how many of each tier remain. Adding it would
   make the collection legible, which helps retention and hurts the deadpan.
