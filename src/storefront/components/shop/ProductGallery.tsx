"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { prefersReduced } from "@/storefront/lib/motion";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.fromTo(".pg-main img", { scale: 1.08, autoAlpha: 0.4 }, { scale: 1, autoAlpha: 1, duration: 1, ease: "expo.out", overwrite: true });
    },
    { scope: ref, dependencies: [idx] },
  );

  useGSAP(
    () => {
      if (prefersReduced()) {
        gsap.set(".pg-main, .pg-thumb", { autoAlpha: 1, y: 0, clearProps: "clipPath" });
        return;
      }
      gsap.from(".pg-main", { clipPath: "inset(10% 5% 10% 5% round 2rem)", duration: 1.6, ease: "expo.out" });
      gsap.from(".pg-thumb", { y: 20, autoAlpha: 0, stagger: 0.07, duration: 1, ease: "expo.out", delay: 0.3 });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="flex flex-col gap-4 md:flex-row-reverse md:gap-6">
      <div className="pg-main relative aspect-[4/5] flex-1 overflow-hidden rounded-[1.5rem] bg-sand md:rounded-[2rem]" style={{ clipPath: "inset(0 round 2rem)" }}>
        {images[idx] && (
          <Image key={images[idx]} src={images[idx]} alt={name} fill priority quality={90} sizes="(max-width:1024px) 100vw, 55vw" className="object-cover" />
        )}
      </div>
      <div className="flex gap-3 md:w-24 md:flex-col">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setIdx(i)}
            className={`pg-thumb relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-sand transition-all duration-500 md:w-full ${i === idx ? "ring-2 ring-ink ring-offset-2 ring-offset-cream" : "opacity-60 hover:opacity-100"}`}
            aria-label={`View image ${i + 1}`}
          >
            <Image src={src} alt="" fill sizes="96px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
