// Rarity tiers. Ordered commonest first; index doubles as the tier level, so
// higher index means rarer, louder colour, and more animation.
//
// `share` is the chance of the tier being drawn, not of any single quote.
// A pull picks a tier by share, then a quote uniformly inside it, so the felt
// rarity stays put no matter how many lines a tier gains or loses.
//
// `short` is the chip label in the Seen filter, where the full name does not
// fit. The full one is the joke and is used everywhere it has room.
//
// `motion` drives the poster:
//   0  nothing
//   1  a slow breath on the background
//   2  breath plus a drifting sweep
//   3  all of it, faster, plus a glow behind the quote
export const TIERS = [
  {
    id: "ultracommon",
    label: "Super ultra mega common",
    short: "Ultra common",
    color: "#8A9A83",
    gradient: ["#9BAA93", "#8A9A83", "#6E7F68"],
    share: 0.46,
    motion: 0,
  },
  {
    id: "common",
    label: "Embarrassingly common",
    short: "Embarrassing",
    color: "#8A8578",
    gradient: ["#9A9587", "#8A8578", "#6E6A5E"],
    share: 0.24,
    motion: 0,
  },
  {
    id: "uncommon",
    label: "Sooo uncommon",
    short: "Sooo uncommon",
    color: "#6E8F8A",
    gradient: ["#7FA09A", "#6E8F8A", "#54706C"],
    share: 0.16,
    motion: 1,
  },
  {
    id: "between",
    label: "Somewhere between rare and legendary",
    short: "Rare-ish",
    color: "#7B7FA8",
    gradient: ["#8D91B8", "#7B7FA8", "#5C6083"],
    share: 0.085,
    motion: 2,
  },
  {
    id: "moos",
    label: "So rare it still moos",
    short: "Moos",
    color: "#B3765C",
    gradient: ["#C68A6E", "#B3765C", "#8A5843"],
    share: 0.035,
    motion: 2,
  },
  {
    id: "unverified",
    label: "Legendary (unverified)",
    short: "Legendary",
    color: "#A8841B",
    gradient: ["#C29C2A", "#A8841B", "#7A5F10"],
    share: 0.015,
    motion: 3,
  },
  {
    // Lowercase on purpose. Do not fix it.
    id: "fish",
    label: "fish",
    short: "fish",
    color: "#2E8B93",
    gradient: ["#3AA6A0", "#2E8B93", "#1E626B"],
    share: 0.005,
    motion: 3,
  },
];

export const DEFAULT_TIER_ID = TIERS[0].id;

// The two rarest tiers get their own notification sound and channel.
export const LOUD_TIER_IDS = ["unverified", "fish"];

const BY_ID = new Map(TIERS.map((tier) => [tier.id, tier]));

// Only the exceptions are listed. Anything absent is the default tier, so
// adding a quote needs no decision and promoting one is deliberate.
// Keyed by text, like the seen history and the notification payload, so it
// survives edits to the quote list.
export const RARITY = {
  // fish
  "even something has meth in it.": "fish",
  "the sun is hot.": "fish",
  "hm.": "fish",
  "glow like the sun to plow like my son.": "fish",
  "I C U P N I forgot what I had else to say.": "fish",

  // Legendary (unverified)
  "a jellyfish has no brain and has survived for five hundred million years. there's hope for you.": "unverified",
  "your skeleton is wet right now. that's information you didn't need, and now it's yours.": "unverified",
  "you're as orange as a banana.": "unverified",
  "imagine a pencis, heck, imagine two pencils.": "unverified",
  "the toaster remembers. the toaster always remembers.": "unverified",
  "heard of H2O? now prepare for the upgrade H2O2.": "unverified",
  "parents are like drugs, you flush them down the toilet when the cops arrive.":
    "unverified",
  "a wall is a floor that refused.": "unverified",
  "productivity is just anxiety with a nicer font.": "unverified",
  "insight is cheap. Tuesday is expensive.": "unverified",

  // So rare it still moos
  "you're breathing manually now. that's on you.": "moos",
  "you said you were going to bed. you're reading this.": "moos",
  "the self-checkout says 'unexpected item in bagging area'. that's you. you're the unexpected item.": "moos",
  "an onion has layers. so do you, but nobody cries when they get through yours.": "moos",
  "it's not 'bad smell' it's your alpha aura, keep going champ.": "moos",
  "did you try turning it off and on again? how about setting it on fire?":
    "moos",
  "while reading this you became an NPC, congratulations.": "moos",
  "heard of sleep? try the premium version, unconsciousness.": "moos",
  "you have never lost an argument you were present for.": "moos",
  "you're not blocked, you are comfortable, and those look identical from inside.":
    "moos",
  "water is just soup that gave up before it started.": "moos",
  "scientifically you're mostly bacteria wearing a hoodie.": "moos",
  "the walls are mad at you.": "moos",
  "today is a good day to start collecting jars.": "moos",
  "bob can be your friend if you accept the terms.": "moos",
  "you should be a sleeper agent, getting paid to sleep is cool.": "moos",

  // Somewhere between rare and legendary
  "the recipe said 'season to taste', and you have no taste.": "between",
  "you just straightened your back. it's already curling. it's fine. we all saw.": "between",
  "your phone unlocks with your face, and some mornings it doesn't recognise you either.": "between",
  "a pig can't look up at the sky. what's your excuse.": "between",
  "you're a limited edition. nobody's collecting.": "between",
  "your horoscope says today will be good. your horoscope is written by a man called Gary.": "between",
  "your phone doesn't feel very comfy with everything it's seen.": "between",
  "go outside and apologize to a tree, it knows what you did.": "between",
  "you have opened this app more times than you have opened a book.": "between",
  "you have a plan B, which is plan A with more hoping.": "between",
  "you were told this would happen. you were told twice. here we are.":
    "between",
  "most of your problems are hypothetical and beautifully detailed.": "between",
  "you have made a beautiful list of things that will not happen.": "between",
  "nobody is going to tell you it is okay. it is okay. that changes nothing.":
    "between",
  "the number between six and seven was removed for safety reasons.": "between",
  "they found a new color but you're not cleared for it.": "between",
  "gravity is optional but nobody has read the manual.": "between",
  "your ceiling has opinions about you and none of them are kind.": "between",
  "the microwave counts down from thirty and judges you the whole time.":
    "between",
  "your washing machine ate that sock on purpose, it had reasons.": "between",
  "the door handle knows exactly how hard you pulled when it said push.":
    "between",
  "you can never face west because it's on your left.": "between",
  "restart your phone for a complete waste of time.": "between",
  "it's time to buy AI-powered electrical jars.": "between",
  "start hogging all the air, become a monopoly.": "between",
  "if day drinking is so bad then why did God invent it?": "between",
  "you have described yourself as low maintenance to at least four people.":
    "between",
  "you're an expert on a subject you learned about last Thursday.": "between",
  "anyway.": "between",
  "okay. that's enough from us.": "between",
  "we ran out of wisdom around Tuesday.": "between",

  // Sooo uncommon
  "soup is just a salad that got into a hot tub.": "uncommon",
  "live, laugh, lie down.": "uncommon",
  "you're emotionally al dente.": "uncommon",
  "a raisin is a grape that let itself go, and it's thriving.": "uncommon",
  "your skeleton is constantly smiling. it doesn't know what's going on either.": "uncommon",
  "the leftovers in the fridge have formed a government.": "uncommon",
  "a muffin is a cake that went to a job interview.": "uncommon",
  "you're the reason the 'are you still watching?' screen exists.": "uncommon",
  "the fridge knows how many times you opened it for nothing.": "uncommon",
  "your keyboard is tired and it's not gonna say anything about it.":
    "uncommon",
  "your mirror is not lying, it's just not being helpful about it.": "uncommon",
  "the stairs are keeping track and you're behind.": "uncommon",
  "your desk lamp has watched your worst hours and stayed on.": "uncommon",
  "the floor is doing all the work and gets none of the credit.": "uncommon",
  "your chair has held you longer than most people have, respect that.":
    "uncommon",
  "your shoes have been everywhere you have and never complained once.":
    "uncommon",
  "the walls heard everything and they're processing it.": "uncommon",
  "the ceiling fan has seen things and keeps spinning anyway. be that.":
    "uncommon",
  "heard of walking? try it faster, that's called running, it's worse.":
    "uncommon",
  "heard of Monday? there's a worse one coming and it's unnamed.": "uncommon",
  "heard of gravity? now prepare for the sequel, falling.": "uncommon",
  "studies show that studies show things, and that's the whole finding.":
    "uncommon",
  "scientists confirmed that thing you thought, they just won't say which.":
    "uncommon",
  "the human body is seventy percent water and thirty percent excuses.":
    "uncommon",
  "you know oxygen? there's a stronger one but you can't handle it.":
    "uncommon",
  "they upgraded time but only for people who wake up early.": "uncommon",
  "salt is just rock you were allowed to eat, think about the others.":
    "uncommon",
  "you have so much potential, and it is going to stay that way.": "uncommon",
  "not everyone is a natural. you are the control group.": "uncommon",
  "some people are born leaders. you were born nearby.": "uncommon",
  "you're doing your best, which raises questions about the rest.": "uncommon",
  "you'd be dangerous if you ever finished anything.": "uncommon",
  "you have the discipline of a man surrounded by snacks.": "uncommon",
  "a houseplant has outlived three of your ambitions.": "uncommon",
  "a pigeon has never once questioned whether it deserves the sandwich.":
    "uncommon",
  "your phone knows you better than your family and likes you slightly less.":
    "uncommon",
  "the dishes are still there. they have made peace with it. you have not.":
    "uncommon",
  "you check the fridge like the answer changes. it does not. it never has.":
    "uncommon",
  "carry a folder. nobody stops a man carrying a folder.": "uncommon",
  "your calendar is a work of fiction with a strong opening chapter.":
    "uncommon",
  "you have never once left a party at the right moment.": "uncommon",
  "your back has started making announcements.": "uncommon",
  "nobody knows what anybody does, and the economy is fine with that.":
    "uncommon",
  "you are a temporary arrangement of matter with strong opinions about traffic.":
    "uncommon",
  "the universe is not testing you. it has not noticed you.": "uncommon",
  "your life is mostly Tuesdays, and that is not a criticism, just arithmetic.":
    "uncommon",
  "you will be forgotten gently, by people who liked you.": "uncommon",
  "this app has no idea who you are and is doing surprisingly well.":
    "uncommon",
  "there is no algorithm here. there is barely a plan.": "uncommon",
  "you could delete this. you won't. we both know how this goes.": "uncommon",
  "nobody reviewed this. it went straight from an idea to your phone.":
    "uncommon",
  "okay bye.": "uncommon",
};

export function tierById(id) {
  return BY_ID.get(id) ?? TIERS[0];
}

// FNV-1a. Any stable hash would do; the point is that a quote lands in the
// same place on every device and every run.
function stableHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

// Unlisted quotes are split between the two common tiers by that hash. Both
// tiers stay populated without anyone curating several hundred lines, and the
// difference between them is a joke about wording, not about quality.
const COMMON_SPLIT = 58;

// Memoised: this runs on every render, for every row of the Seen list, and
// once per candidate on every weighted pull, so the hash should happen once
// per quote rather than once per lookup.
const TIER_CACHE = new Map();

export function tierOf(quote) {
  const cached = TIER_CACHE.get(quote);
  if (cached) return cached;

  const assigned = RARITY[quote];
  const tier = assigned
    ? tierById(assigned)
    : stableHash(quote) < COMMON_SPLIT
      ? TIERS[0]
      : TIERS[1];
  TIER_CACHE.set(quote, tier);
  return tier;
}

export function tierLevel(quote) {
  return TIERS.indexOf(tierOf(quote));
}

export function isLoudTier(quote) {
  return LOUD_TIER_IDS.includes(tierOf(quote).id);
}

// Picks a tier by its share, then a quote uniformly within it. Tiers with no
// members are skipped and the remaining shares renormalised, so an empty tier
// cannot swallow draws.
export function weightedRandomQuote(quotes, exclude) {
  const pool = quotes.length > 1 ? quotes.filter((q) => q !== exclude) : quotes;
  if (pool.length === 0) return quotes[0];

  const buckets = new Map();
  for (const quote of pool) {
    const id = tierOf(quote).id;
    const bucket = buckets.get(id);
    if (bucket) bucket.push(quote);
    else buckets.set(id, [quote]);
  }

  const present = TIERS.filter((tier) => buckets.has(tier.id));
  let total = 0;
  const cumulative = present.map((tier) => {
    total += tier.share;
    return total;
  });

  const target = Math.random() * total;
  let index = cumulative.findIndex((edge) => edge > target);
  if (index < 0) index = present.length - 1;

  const bucket = buckets.get(present[index].id);
  return bucket[Math.floor(Math.random() * bucket.length)];
}
