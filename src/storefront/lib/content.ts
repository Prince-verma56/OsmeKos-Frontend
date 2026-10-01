/**
 * Homepage editorial copy.
 *
 * Product data (percentages, INCI, how-to-use, reviews) stays in products.ts,
 * which is the canonical source other routes import. This file holds only the
 * section-level writing, so a copy review is a single-file operation and it
 * stays obvious when a claim is not traceable to real data.
 */

/** Brand register. Deliberately shares no terms with the ingredient ticker:
 *  every one of these is printed on the bottle or stated elsewhere on the page. */
export const MARQUEE_HOME = [
  "Nourish",
  "Hydrate",
  "Soften",
  "For all skin types",
  "Non-greasy",
  "Made in India",
] as const;

export const INTRO = {
  eyebrow: "Daily care",
  lead: "Most lotions sit on the surface. Ours is built to work with your skin: hydrate the upper layers, replenish lost lipids, and support the barrier that keeps everything in balance.",
  /** Each figure is traceable to INGREDIENTS in products.ts. */
  benefits: [
    {
      pct: "6%",
      extra: null,
      title: "Deep hydration",
      text: "Glycerin draws moisture in and keeps it there for hours, not minutes.",
    },
    {
      pct: "3%",
      extra: "+0.5%",
      title: "Nourishment",
      text: "Shea Butter, Coconut Oil and Vitamin E feed dry skin without the heavy residue.",
    },
    {
      pct: "0.9%",
      extra: "+2%",
      title: "Soft, smooth skin",
      text: "Ceramides and Niacinamide rebuild the barrier so smoothness lasts beyond the first hour.",
    },
  ],
} as const;

/** A study of the object. The formula itself belongs to the Ingredients
 *  section immediately above — these three describe the physical product. */
export const SHOWCASE = [
  {
    n: "01",
    title: "The bottle",
    text: "Crafted for prominence, our 200ml heavyweight vessel is designed to elevate your daily routine. Radical transparency is at its core—all six active concentrations are prominently displayed on the front label. You know exactly what you're putting on your skin, and precisely how much of it.",
    image: "/products/front.webp",
    frame: "aspect-[3/4]",
  },
  {
    n: "02",
    title: "The pump",
    text: "Engineered for effortless dispensation. The premium gold-accented collar houses a highly precise mechanism that delivers the exact dose required for a perfect application. No spills, no clogs, and zero waste—just a smooth, controlled experience every single time.",
    image: "/products/pump.webp",
    frame: "aspect-[7/8]",
  },
  {
    n: "03",
    title: "The label",
    text: "Minimalist aesthetic meets exhaustive detail. Beyond the beautiful typography lies a comprehensive INCI list outlining every single ingredient. Proudly formulated, designed, and manufactured in India to global standards, ensuring uncompromising quality in every batch.",
    image: "/products/back.webp",
    frame: "aspect-[2/5]",
  },
] as const;

export const TEXTURE = {
  eyebrow: "Texture",
  lead: "A silky emulsion that melts on contact. It leaves a soft, breathable finish you can dress over in seconds, with hydration that keeps working long after.",
  caption: "Swatch, worked into skin",
  features: [
    "Absorbs quickly",
    "Non-greasy finish",
    "Leaves skin soft and smooth",
    "Perfect for daily use",
  ],
} as const;

/** Captions are observations about the frame, not repeated headlines from
 *  other sections. */
export const GALLERY = [
  { src: "/products/more-than-moisture.webp", cap: "Daily care for softer skin", ratio: "aspect-[4/5]", h: "58vh" },
  { src: "/products/lightweight.webp", cap: "Worked in, in seconds", ratio: "aspect-[3/2]", h: "48vh" },
  { src: "/products/flatlay-towel.webp", cap: "After the shower", ratio: "aspect-square", h: "54vh" },
  { src: "/products/formulated.webp", cap: "Six actives, printed", ratio: "aspect-[4/5]", h: "58vh" },
  { src: "/products/back-label-scene.webp", cap: "Full INCI on the back", ratio: "aspect-[3/2]", h: "48vh" },
  { src: "/products/brand-hero.webp", cap: "200ml, made in India", ratio: "aspect-square", h: "54vh" },
] as const;
