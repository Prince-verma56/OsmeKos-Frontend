"use client";

import Link from "next/link";
import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger, useGSAP } from "@/storefront/lib/gsap";
import { useCart, cartCount } from "@/storefront/store/cart";
import { useUI } from "@/storefront/store/ui";
import { EASE, prefersReduced } from "@/storefront/lib/motion";
import { IconArrow, IconBag, IconClose } from "./ui/Icons";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/about", label: "Our Story" },
  { href: "/reviews", label: "Reviews" },
];

const MENU_LINKS = [
  ...LINKS,
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/cart", label: "Cart" },
];

function Logo({ light }: { light: boolean }) {
  return (
    <Link href="/" aria-label="OsmeKos home" className="nav-item flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-chip border font-display text-[15px] leading-none tracking-[-0.06em] transition-colors duration-500 ${
          light ? "border-cream/40 text-cream" : "border-ink/20 text-ink"
        }`}
      >
        OK
      </span>
      <span className="text-[22px] font-bold tracking-[-0.04em] md:text-[24px]">
        OsmeKos
        <sup className="ml-0.5 align-top text-[8px] font-semibold tracking-normal">TM</sup>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const ref = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const menuOpen = useUI((s) => s.menuOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  const lenis = useUI((s) => s.lenis);
  const pathname = usePathname();
  const count = hydrated ? cartCount(lines) : 0;

  // Entrance, then hide on scroll-down / reveal on scroll-up.
  useGSAP(
    () => {
      const nav = ref.current!;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (pathname === "/") {
          // The nav arrives with the hero copy so the fold resolves as one
          // move. It listens for the hero's cue but never depends on it —
          // navigation must not be withheld while a video buffers.
          gsap.set(".nav-shell", { autoAlpha: 0, y: -24 });
          gsap.set(".nav-item", { y: -10, autoAlpha: 0 });

          let played = false;
          const playNav = () => {
            if (played) return;
            played = true;
            gsap.to(".nav-shell", { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE.expo });
            gsap.to(".nav-item", { y: 0, autoAlpha: 1, duration: 1, stagger: 0.05, ease: EASE.expo, delay: 0.2 });
          };

          window.addEventListener("videoReveal", playNav, { once: true });
          
          let fallback: ReturnType<typeof setTimeout>;
          const unsubscribe = useUI.subscribe((state) => {
            if (state.loaded && !played) {
              // Wait 2.5s after preloader finishes as a fallback if videoReveal fails
              fallback = setTimeout(playNav, 2500);
            }
          });

          return () => {
            window.removeEventListener("videoReveal", playNav);
            clearTimeout(fallback);
            unsubscribe();
          };
        } else {
          gsap.from(".nav-shell", { autoAlpha: 0, y: -24, duration: 1.2, ease: EASE.expo, delay: 0.1 });
          gsap.from(".nav-item", { y: -10, autoAlpha: 0, duration: 1, stagger: 0.05, ease: EASE.expo, delay: 0.3 });
        }
      });

      ScrollTrigger.create({
        id: "nav",
        start: "top -120",
        end: "max",
        onUpdate: (self) => {
          const hide = self.direction === 1 && !useUI.getState().menuOpen;
          gsap.to(nav, { yPercent: hide ? -140 : 0, duration: 0.6, ease: EASE.expo, overwrite: "auto" });
        },
        onToggle: (self) => nav.classList.toggle("is-scrolled", self.isActive),
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  // Liquid pill that glides under the hovered link.
  useEffect(() => {
    const wrap = linksRef.current;
    const pill = pillRef.current;
    if (!wrap || !pill) return;
    const links = Array.from(wrap.querySelectorAll<HTMLElement>("a"));
    const moveTo = (el: HTMLElement) =>
      gsap.to(pill, { x: el.offsetLeft, width: el.offsetWidth, autoAlpha: 1, duration: 0.55, ease: EASE.expo });
    const enter = (e: Event) => moveTo(e.currentTarget as HTMLElement);
    const leave = () => gsap.to(pill, { autoAlpha: 0, duration: 0.35, ease: "power2.out" });
    links.forEach((l) => {
      l.addEventListener("mouseenter", enter);
      l.addEventListener("focus", enter);
    });
    wrap.addEventListener("mouseleave", leave);
    wrap.addEventListener("focusout", leave);
    return () => {
      links.forEach((l) => {
        l.removeEventListener("mouseenter", enter);
        l.removeEventListener("focus", enter);
      });
      wrap.removeEventListener("mouseleave", leave);
      wrap.removeEventListener("focusout", leave);
    };
  }, []);

  // Menu open/close. autoAlpha is what takes the closed menu's eight links out
  // of the tab order — clip-path alone is purely visual.
  useGSAP(
    () => {
      const m = menuRef.current!;
      const reduced = prefersReduced();

      if (menuOpen) {
        gsap.set(m, { pointerEvents: "auto", autoAlpha: 1 });
        const tl = gsap.timeline();
        tl.to(m, {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: reduced ? 0.2 : 0.9,
          ease: reduced ? "power2.out" : "expo.inOut",
        });
        if (!reduced) {
          tl.from(".menu-link", { yPercent: 110, duration: 1, stagger: 0.07, ease: EASE.expo }, "-=0.4").from(
            ".menu-meta",
            { autoAlpha: 0, y: 10, duration: 0.6 },
            "-=0.6",
          );
        }
        lenis?.stop();
      } else {
        gsap.to(m, {
          clipPath: "inset(0% 0% 100% 0%)",
          duration: reduced ? 0.2 : 0.6,
          ease: reduced ? "power2.in" : "expo.inOut",
          onComplete: () => gsap.set(m, { pointerEvents: "none", autoAlpha: 0 }),
        });
        lenis?.start();
      }
    },
    { scope: menuRef, dependencies: [menuOpen] },
  );

  // Escape + body scroll lock while the menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    // Captured now: by cleanup time the ref may point elsewhere.
    const toggle = toggleRef.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      toggle?.focus();
    };
  }, [menuOpen, setMenuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header ref={ref} className="group/nav fixed inset-x-0 top-0 z-[100] px-3 pt-1 md:px-6 md:pt-2">
        <div
          className={`nav-shell relative mx-auto flex h-[62px] max-w-[1360px] items-center justify-between rounded-chip border pl-3 pr-2 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 md:h-[68px] md:pl-4 ${
            menuOpen
              ? "border-cream/15 bg-ink text-cream"
              : pathname === "/"
                ? "border-transparent bg-transparent text-ink group-[.is-scrolled]/nav:border-line group-[.is-scrolled]/nav:bg-paper/95 group-[.is-scrolled]/nav:shadow-card group-[.is-scrolled]/nav:backdrop-blur-md"
                : "border-line bg-paper/92 text-ink shadow-rise group-[.is-scrolled]/nav:bg-paper group-[.is-scrolled]/nav:shadow-card"
          }`}
        >
          <div className="relative flex items-center gap-2">
            <button
              ref={toggleRef}
              className="nav-item flex h-11 w-11 items-center justify-center rounded-chip lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="primary-menu"
            >
              <span className="relative block h-3 w-5">
                <span
                  className={`absolute left-0 top-0 h-px w-full bg-current transition-transform duration-500 ${menuOpen ? "translate-y-[5.5px] rotate-45" : ""}`}
                />
                <span
                  className={`absolute bottom-0 left-0 h-px w-full bg-current transition-transform duration-500 ${menuOpen ? "-translate-y-[5.5px] -rotate-45" : ""}`}
                />
              </span>
            </button>
            <Logo light={menuOpen} />
          </div>

          <nav
            ref={linksRef}
            aria-label="Primary"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center lg:flex"
          >
            <span
              ref={pillRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-full w-0 rounded-chip bg-sand/70 opacity-0"
            />
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className="nav-item relative z-10 rounded-chip px-4 py-2.5 text-sm font-medium tracking-[-0.01em] text-ink-3 transition-colors duration-300 hover:text-ink"
              >
                {l.label}
                {isActive(l.href) && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="relative flex items-center gap-1.5 md:gap-2">
            <button
              onClick={openCart}
              className={`nav-item relative flex h-11 w-11 items-center justify-center rounded-chip border transition-colors duration-300 ${
                menuOpen ? "border-cream/25 hover:bg-cream hover:text-ink" : "border-line hover:bg-sand/60"
              }`}
              aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`}
            >
              <IconBag className="h-5 w-5" />
              <span
                aria-hidden
                className={`num absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink transition-transform duration-500 ${count ? "scale-100" : "scale-0"}`}
              >
                {count}
              </span>
            </button>
            <Link
              href="/shop"
              className="nav-item group/btn relative hidden h-11 items-center gap-2 overflow-hidden rounded-chip bg-ink pl-5 pr-4 text-[13px] font-semibold text-cream sm:flex"
            >
              <span
                aria-hidden
                className="absolute inset-0 translate-y-full rounded-chip bg-gold transition-transform duration-500 ease-[var(--ease-expo)] group-hover/btn:translate-y-0"
              />
              <span className="relative transition-colors duration-500 group-hover/btn:text-ink">Shop Now</span>
              <IconArrow className="relative h-4 w-4 transition-all duration-500 group-hover/btn:translate-x-0.5 group-hover/btn:text-ink" />
            </Link>
          </div>
        </div>
      </header>

      <div
        ref={menuRef}
        id="primary-menu"
        className="invisible pointer-events-none fixed inset-0 z-[110] bg-ink text-cream"
        style={{ clipPath: "inset(0% 0% 100% 0%)" }}
      >
        <div className="container-x flex h-full flex-col justify-between pb-10 pt-32">
          <nav aria-label="Menu" className="flex flex-col gap-1">
            {MENU_LINKS.map((l) => (
              <div key={l.href} className="overflow-hidden">
                <Link
                  href={l.href}
                  className="menu-link display block text-[14vw] leading-[1.08] text-cream"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </Link>
              </div>
            ))}
          </nav>
          <div className="menu-meta flex items-end justify-between text-eyebrow uppercase tracking-[0.25em] text-cream/50">
            <span>Skincare that feels right</span>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
