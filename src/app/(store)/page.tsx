import Hero from "@/storefront/components/home/Hero";
import Intro from "@/storefront/components/home/Intro";
import Ingredients from "@/storefront/components/home/Ingredients";
import Showcase from "@/storefront/components/home/Showcase";
import Texture from "@/storefront/components/home/Texture";
import Gallery from "@/storefront/components/home/Gallery";
import Ritual from "@/storefront/components/home/Ritual";
import Reviews from "@/storefront/components/home/Reviews";
import ShopCta from "@/storefront/components/home/ShopCta";
import TapeMarquee from "@/storefront/components/home/TapeMarquee";
import { fetchProductsSafely } from "@/storefront/lib/products";

export const revalidate = 300;

export default async function Home() {
  const products = await fetchProductsSafely();
  const hero = products.find((p) => p.available) ?? products[0] ?? null;

  return (
    <>
      <Hero />
      <TapeMarquee />
      <Intro />
      <Ingredients />
      <Showcase />
      <Texture />
      <Gallery />
      <Ritual />
      <Reviews />
      <ShopCta product={hero} />
    </>
  );
}
