import type { Metadata } from "next";
import "./store.css";
import { manrope, outfit } from "../fonts";
import SmoothScroll from "@/storefront/components/SmoothScroll";
import Navbar from "@/storefront/components/Navbar";
import CartDrawer from "@/storefront/components/CartDrawer";
import Footer from "@/storefront/components/Footer";
import ScrollProgress from "@/storefront/components/fx/ScrollProgress";
import { fetchProductsSafely } from "@/storefront/lib/products";
import Preloader from "@/components/Preloader";

export const metadata: Metadata = {
  metadataBase: new URL("https://osmekos.com"),
  title: {
    default: "OsmeKos — Skincare that feels right",
    template: "%s — OsmeKos",
  },
  description:
    "OsmeKos Body Lotion with Triple Ceramide Complex, Niacinamide, Shea Butter and Vitamin E. Deep hydration, non-greasy, for all skin types.",
  openGraph: {
    title: "OsmeKos — Skincare that feels right",
    description: "Thoughtfully formulated body care. Nourish. Hydrate. Soften.",
    images: ["/products/brand-hero.webp"],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const products = await fetchProductsSafely();
  const shopLinks: [string, string][] = products
    .slice(0, 3)
    .map((p) => [p.name, `/product/${p.slug}`] as [string, string]);

  return (
    <html lang="en" className={`${outfit.variable} ${manrope.variable}`} suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions commonly inject attributes
          on <html>/<body> before React hydrates. No app state is rendered here. */}
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Preloader />
        <SmoothScroll />
        <ScrollProgress />
        <Navbar />
        <CartDrawer />
        <main id="main">{children}</main>
        <Footer shopLinks={shopLinks} />
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
