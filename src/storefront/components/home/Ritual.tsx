"use client";

import { useRef } from "react";
import { motion, MotionConfig, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { HOW_TO_USE } from "@/storefront/lib/products";
import ParallaxImage from "@/storefront/components/ui/ParallaxImage";
import { outfit } from "@/app/fonts";

export default function Ritual() {
  const ref = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"]
  });

  const reduced = useReducedMotion();
  const scrubbed = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  // A line that draws itself is motion. Reduced motion gets the finished line,
  // which is what it was drawing toward anyway.
  const spineHeight = reduced ? "100%" : scrubbed;

  return (
    <MotionConfig reducedMotion="user">
    <section ref={ref} className="on-ink section relative bg-ink text-cream py-24 md:py-32">
      <div className="container-x grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`eyebrow text-gold-3 tracking-[0.2em] uppercase font-semibold text-sm ${outfit.className}`}
            >
              How to use
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`mt-5 text-[3.5rem] md:text-[4.5rem] leading-[1.05] tracking-tight font-bold text-cream ${outfit.className}`}
            >
              Three steps. <br/><span className="text-gold-3">Twice</span> a day.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`mt-8 max-w-[42ch] text-[16px] leading-[1.7] text-cream/70 font-medium ${outfit.className}`}
            >
              For external use only. Do a patch test before first use and avoid contact with eyes. Store
              in a cool, dry place away from direct sunlight.
            </motion.p>
            <ParallaxImage
              src="/products/lightweight.webp"
              alt="Lotion being massaged into skin in slow circles"
              speed={0.8}
              quality={75}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="mt-12 aspect-[16/9] rounded-[2rem] shadow-2xl lg:aspect-[4/3]"
            />
          </div>
        </div>

        <div className="lg:col-span-6 lg:col-start-7 pt-12 lg:pt-0">
          <ol className="relative pb-10">
            {/* Animated Spine */}
            <span
              aria-hidden
              className="absolute bottom-0 left-[0.4rem] top-[4rem] w-px bg-cream/10 md:left-[0.55rem]"
            >
              <motion.span 
                style={{ height: spineHeight }}
                className="block w-full origin-top bg-gold-3" 
              />
            </span>

            {HOW_TO_USE.map((s, i) => (
              <motion.li 
                key={s.title} 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="step relative py-12 pl-12 md:py-16 md:pl-20"
              >
                <span
                  aria-hidden
                  className="absolute left-[-4px] top-[4rem] h-[14px] w-[14px] rounded-full border-[3px] border-ink bg-gold-3 md:top-[4.8rem] md:left-[-1px]"
                />
                <div className="flex flex-col gap-4 md:flex-row md:items-baseline md:gap-10">
                  <span className={`shrink-0 text-[3rem] md:text-[4rem] leading-none text-gold-3 font-bold ${outfit.className}`}>
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className={`text-[2rem] md:text-[2.5rem] font-semibold text-cream ${outfit.className}`}>
                      {s.title}
                    </h3>
                    <p className={`mt-4 max-w-[46ch] text-[16px] leading-relaxed text-cream/70 font-medium ${outfit.className}`}>
                      {s.text}
                    </p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
    </MotionConfig>
  );
}
