import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import ShopGrid from "@/storefront/components/shop/ShopGrid";
import { fetchShopProducts, fetchCollectionsSafely } from "@/storefront/lib/products";

export const metadata: Metadata = { title: "Shop" };

export const revalidate = 300;

export default async function ShopPage() {
  const [products, collections] = await Promise.all([fetchShopProducts(), fetchCollectionsSafely()]);

  return (
    <div className="pb-24 md:pb-40">
      <PageHeader eyebrow="Shop" title={<>Everything your skin <em>needs.</em></>} text="One honest lotion, thoughtfully bundled. More barrier-first essentials arriving soon." />
      <div className="container-x mt-14 md:mt-20">
        <ShopGrid products={products} collections={collections} />
      </div>
    </div>
  );
}
