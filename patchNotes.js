// In-app patch notes, newest first. Written in the app's voice: the wrapper
// stays sincere, the content does not (BRAND.md).
//
// Keep entries short. Nobody has ever wanted longer patch notes.
export const PATCH_NOTES = [
  {
    version: "1.1.2",
    date: "6 September 2026",
    title: "The rationing update",
    sections: [
      {
        heading: "Changed",
        items: [
          "Shuffle is now twice a day. This is not a bug, it is a boundary.",
          "The clock starts on your first shuffle, not at midnight, so there is nothing to stay up for.",
          "Notifications are untouched. They were always the point. Shuffle was a snack.",
        ],
      },
      {
        heading: "Why",
        items: [
          "Somebody read all 766 quotes in one sitting. In an afternoon. On purpose. Imagine.",
          "Not most of them. All of them. There is no rare one still out there for him, nothing left to find. He got the last one too.",
          "He has seen everything this app will ever say to him, and he was done before dinner.",
          "His number has since gone down. Some of what he collected was deleted two updates ago and should never have counted. He will have to do it again.",
          "The rest of you get two a day now. Thank him.",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Seen could climb past the total, which is how somebody reached 767 of 766. Quotes removed in an earlier update were still being counted, and a quote could be held twice under two spellings.",
          "If your number went down, that is the fix. You did not lose anything you still had.",
        ],
      },
    ],
  },
  {
    version: "1.1.1",
    date: "26 August 2026",
    title: "The one where you could see it",
    sections: [
      {
        heading: "Fixed",
        items: [
          "The tier filters were written in their own tier colour, on a background of very nearly that colour. They are black now, which is a colour you can see.",
          "The filters no longer run off the side of the screen into a place nobody knew they could scroll to.",
          "The rarity under each quote was also invisible. It has stopped being invisible.",
          "The filter labels were getting their bottoms cut off. They now have bottoms.",
          "The \u201cWhat\u2019s new?\u201d button was nearly invisible on the darker posters, which is a bold choice for a button whose entire job is being noticed. It brings its own background now.",
        ],
      },
      {
        heading: "Not fixed",
        items: [
          "The quotes. Those are working as intended.",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "19 August 2026",
    title: "The rarity update (like my mom says i am)",
    sections: [
      {
        heading: "Seven deadly tiers",
        items: [
          "Quotes now have a rarity. Seven of them, from “Super ultra mega common” down to “fish”.",
          "Every rarity has its own colour. The screen, the notification, and your Seen list all wear it.",
          "The rarer the quote, the more the screen moves. The common ones sit perfectly still, as they deserve.",
          "A new sound for the two rarest tiers. It is short, it is triumphant, and it is not the bleep.",
          "Seen now filters by tier, but only by the ones you have actually pulled. We are not telling you what is left.",
        ],
      },
      {
        heading: "About that sound",
        items: [
          "You will hear it roughly once a fortnight. Unless you muted us, in which case you will hear nothing, ever, and you will not know what you missed.",
          "The people who left notifications on are hearing it right now. Just so you know.",
          "We are not saying turn the sound back on. We are saying “fish” exists and you have never met it.",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Nothing. Everything was already fine. Stop asking.",
        ],
      },
    ],
  },
  {
    version: "1.0.3",
    date: "19 August 2026",
    title: "The apostrophe update",
    sections: [
      {
        heading: "Added",
        items: [
          "454 new quotes. 766 in total, which is more than you will read.",
          "Punctuation. Turns out people notice this. People notice everything except the things that matter.",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Every missing apostrophe. “Youre” is now “you're”. We are as surprised as you are.",
          "Sentences now start with a capital letter, like in books.",
        ],
      },
    ],
  },
  {
    version: "1.0.2",
    date: "9 August 2026",
    title: "The one where notifications worked",
    sections: [
      {
        heading: "Added",
        items: [
          "A notification sound. Short. You will learn to resent it.",
          "Shared images are square now, so the logo survives the group chat.",
          "A “Seen” list, for the quotes you have already survived.",
        ],
      },
      {
        heading: "Fixed",
        items: [
          "Notifications arriving three at a time, like buses.",
          "Quotes now count as seen when they arrive, not only when you care enough to tap.",
        ],
      },
      {
        heading: "Removed",
        items: ["The Copy button. Nobody used it. Be honest."],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "27 July 2026",
    title: "It exists",
    sections: [
      {
        heading: "Added",
        items: ["The app.", "Quotes nobody asked for, at hours nobody chose."],
      },
      {
        heading: "Known issues",
        items: ["All of it."],
      },
    ],
  },
];
