// Procedural poster backgrounds, on-brand (see BRAND.md): every background is
// a variation of the sage field, with translucent shapes drawn from the brand
// palette. Deterministic per index, so no image assets are bundled.

// Brand palette (BRAND.md).
export const BRAND = {
  sage: "#8A9A83",
  sageDeep: "#6E7F68",
  sageLight: "#9BAA93",
  cream: "#F7F3EA",
  sand: "#D9CDB6",
  terracotta: "#B3765C",
};

// Gradient variations of the sage field. All stay within the three sage
// tones so every poster reads as the same calm app; variety comes from
// direction, stop order, and the shapes.
const GRADIENTS = [
  [BRAND.sageLight, BRAND.sage, BRAND.sageDeep],
  [BRAND.sage, BRAND.sageDeep],
  [BRAND.sageLight, BRAND.sage],
  [BRAND.sage, BRAND.sageLight, BRAND.sage],
  [BRAND.sageDeep, BRAND.sage],
  [BRAND.sageLight, BRAND.sageDeep],
  [BRAND.sage, BRAND.sageDeep, BRAND.sage],
  [BRAND.sageDeep, BRAND.sage, BRAND.sageLight],
];

const BACKGROUND_VARIANTS = 24;

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

// Shape colors: mostly cream/sand/deep sage, terracotta as the rare accent.
function shapeColor(rand) {
  const r = rand();
  if (r < 0.35) return BRAND.cream;
  if (r < 0.65) return BRAND.sand;
  if (r < 0.88) return BRAND.sageDeep;
  return BRAND.terracotta;
}

function buildBackground(index) {
  const rand = mulberry32(index * 7919 + 13);
  const colors = GRADIENTS[index % GRADIENTS.length];
  const shapeCount = 3 + Math.floor(rand() * 4); // 3-6 shapes
  const shapes = [];
  for (let i = 0; i < shapeCount; i++) {
    const size = 80 + rand() * 260;
    shapes.push({
      size,
      // Positions in % of screen; allowed to bleed off the edges.
      left: rand() * 120 - 30,
      top: rand() * 120 - 30,
      color: shapeColor(rand),
      opacity: 0.05 + rand() * 0.1,
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

export const BACKGROUND_COUNT = BACKGROUND_VARIANTS;

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
