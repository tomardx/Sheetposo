// Procedural "weird poster" backgrounds: each entry is a gradient palette plus
// deterministically generated translucent shapes, so every background index
// always renders the same visual without bundling any image assets.

const PALETTES = [
  ["#ff00cc", "#333399"],
  ["#f83600", "#f9d423"],
  ["#00c9ff", "#92fe9d"],
  ["#fc466b", "#3f5efb"],
  ["#0f2027", "#203a43", "#2c5364"],
  ["#355c7d", "#6c5b7b", "#c06c84"],
  ["#8e2de2", "#4a00e0"],
  ["#11998e", "#38ef7d"],
  ["#ff512f", "#dd2476"],
  ["#1a2a6c", "#b21f1f", "#fdbb2d"],
  ["#373b44", "#4286f4"],
  ["#e65c00", "#f9d423"],
  ["#c31432", "#240b36"],
  ["#7f00ff", "#e100ff"],
  ["#141e30", "#243b55"],
  ["#42275a", "#734b6d"],
  ["#ff9966", "#ff5e62"],
  ["#00b09b", "#96c93d"],
  ["#20002c", "#cbb4d4"],
  ["#f953c6", "#b91d73"],
  ["#4b6cb7", "#182848"],
  ["#f12711", "#f5af19"],
  ["#659999", "#f4791f"],
  ["#dd3e54", "#6be585"],
  ["#8360c3", "#2ebf91"],
  ["#544a7d", "#ffd452"],
  ["#009fff", "#ec2f4b"],
  ["#654ea3", "#eaafc8"],
];

// Small deterministic PRNG so shapes are stable per background index.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBackground(index) {
  const rand = mulberry32(index * 7919 + 13);
  const colors = PALETTES[index % PALETTES.length];
  const shapeCount = 3 + Math.floor(rand() * 4); // 3-6 shapes
  const shapes = [];
  for (let i = 0; i < shapeCount; i++) {
    const size = 80 + rand() * 260;
    shapes.push({
      size,
      // Positions in % of screen; allowed to bleed off the edges.
      left: rand() * 120 - 30,
      top: rand() * 120 - 30,
      color: rand() > 0.5 ? "#ffffff" : "#000000",
      opacity: 0.05 + rand() * 0.13,
      // Rings vs filled blobs; squircles vs circles.
      ring: rand() > 0.6,
      squircle: rand() > 0.7,
      rotate: Math.floor(rand() * 90),
    });
  }
  // Gradient direction varies per background.
  const start = { x: rand(), y: 0 };
  const end = { x: rand(), y: 1 };
  return { colors, shapes, start, end };
}

export const BACKGROUND_COUNT = PALETTES.length;

export const BACKGROUNDS = Array.from({ length: BACKGROUND_COUNT }, (_, i) =>
  buildBackground(i)
);

export function randomBackgroundIndex(excludeIndex = -1) {
  if (BACKGROUND_COUNT <= 1) return 0;
  let idx;
  do {
    idx = Math.floor(Math.random() * BACKGROUND_COUNT);
  } while (idx === excludeIndex);
  return idx;
}
