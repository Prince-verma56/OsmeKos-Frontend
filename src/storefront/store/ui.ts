import { create } from "zustand";
import type Lenis from "lenis";

type UIState = {
  /** null when the user prefers reduced motion — scrolling is then native. */
  lenis: Lenis | null;
  setLenis: (l: Lenis | null) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  loaded: boolean;
  setLoaded: (v: boolean) => void;
};

export const useUI = create<UIState>((set) => ({
  lenis: null,
  setLenis: (lenis) => set({ lenis }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  loaded: false,
  setLoaded: (loaded) => set({ loaded }),
}));
