"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";

type Cat = "Active" | "Moisture" | "Texture" | "Preservation" | "Scent";

const ROWS: { name: string; pct?: string; cat: Cat; does: string }[] = [
  { name: "Aqua", cat: "Texture", does: "Water, the base the whole formula is built on." },
  { name: "Glycerin", pct: "6%", cat: "Moisture", does: "Humectant. Draws water into the upper layers of skin and holds it there." },
  { name: "Cetearyl Alcohol", cat: "Texture", does: "Fatty alcohol that softens skin and gives the lotion body. Not a drying alcohol." },
  { name: "Cetyl Alcohol", cat: "Texture", does: "Fatty alcohol. Adds slip and a smooth, cushioned feel." },
  { name: "Glyceryl Stearate SE", cat: "Texture", does: "Emulsifier that keeps the oils and water evenly blended." },
  { name: "Ceteareth-20", cat: "Texture", does: "Emulsifier that keeps the formula stable and uniform." },
  { name: "C12-15 Alkyl Benzoate", cat: "Texture", does: "Lightweight emollient behind the silky, non-greasy finish." },
  { name: "Isododecane", cat: "Texture", does: "Light emollient that spreads easily and evaporates quickly." },
  { name: "Butyrospermum Parkii (Shea) Butter", pct: "3%", cat: "Moisture", does: "Emollient rich in fatty acids. Nourishes and softens dry patches." },
  { name: "Niacinamide", pct: "2%", cat: "Active", does: "Vitamin B3. Supports the skin barrier and a more even-looking tone." },
  { name: "Cocos Nucifera (Coconut) Oil", pct: "2%", cat: "Moisture", does: "Emollient that helps skin hold on to moisture." },
  { name: "Palmitic Acid", pct: "1%", cat: "Moisture", does: "Fatty acid found naturally in the skin's lipid layer." },
  { name: "Stearic Acid", pct: "1%", cat: "Moisture", does: "Fatty acid that supports barrier lipids and adds richness." },
  { name: "Dimethicone (and) Dimethiconol", cat: "Texture", does: "Silicones that give a smooth, breathable, non-sticky finish." },
  { name: "Carbomer", cat: "Texture", does: "Thickener that gives the lotion its soft, pumpable consistency." },
  { name: "Tocopherol", pct: "0.5%", cat: "Active", does: "Vitamin E. Antioxidant that protects skin and formula lipids." },
  { name: "Ceramide NP", pct: "0.5%", cat: "Active", does: "Skin-identical ceramide. Part of the Triple Ceramide Complex." },
  { name: "Ceramide AP", pct: "0.2%", cat: "Active", does: "Skin-identical ceramide. Part of the Triple Ceramide Complex." },
  { name: "Ceramide EOP", pct: "0.2%", cat: "Active", does: "Skin-identical ceramide. Part of the Triple Ceramide Complex." },
  { name: "Phenoxyethanol", cat: "Preservation", does: "Preservative that keeps the lotion safe from microbes after opening." },
  { name: "Sodium Benzoate", cat: "Preservation", does: "Preservative that works alongside phenoxyethanol." },
  { name: "Disodium EDTA", cat: "Preservation", does: "Chelating agent. Keeps the formula stable and clear of mineral traces." },
  { name: "Fragrance", cat: "Scent", does: "The light, subtle scent." },
  { name: "Limonene, Citronellol, Linalool, Geraniol, Hexyl Cinnamal", cat: "Scent", does: "Fragrance components, declared individually so you can check for sensitivities." },
];

const CATS: ("All" | Cat)[] = ["All", "Active", "Moisture", "Texture", "Preservation", "Scent"];

export default function InciTable() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) {
        gsap.set(".inci-row", { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.to(".inci-row", {
        opacity: (_i, el: HTMLElement) => (cat === "All" || el.dataset.cat === cat ? 1 : 0.22),
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.012,
      });
    },
    { scope: ref, dependencies: [cat] },
  );

  return (
    <div ref={ref}>
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors duration-300 ${
              cat === c ? "border-ink bg-ink text-cream" : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ol className="mt-8 border-t border-line">
        {ROWS.map((r, i) => (
          <li
            key={r.name}
            data-cat={r.cat}
            className="inci-row grid grid-cols-[2.2rem_1fr] gap-x-4 gap-y-1 border-b border-line py-4 md:grid-cols-[3rem_minmax(0,1.1fr)_minmax(0,1.4fr)_7rem] md:items-baseline md:gap-6"
          >
            <span className="font-display text-sm text-gold-2">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-medium text-ink">
              {r.name}
              {r.pct && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 font-display text-[12px] text-cream">{r.pct}</span>}
            </span>
            <span className="col-start-2 text-[14px] leading-relaxed text-ink-2 md:col-start-auto">{r.does}</span>
            <span className="col-start-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted md:col-start-auto md:text-right">{r.cat}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
