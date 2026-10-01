import type { MetadataRoute } from "next";
import { fetchProductsSafely } from "@/storefront/lib/products";
import { SITE } from "@/storefront/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await fetchProductsSafely();
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "weekly"],
    ["/shop", 0.9, "weekly"],
    ["/ingredients", 0.8, "monthly"],
    ["/reviews", 0.7, "weekly"],
    ["/about", 0.6, "monthly"],
    ["/faq", 0.6, "monthly"],
    ["/contact", 0.5, "yearly"],
    ["/shipping-returns", 0.4, "yearly"],
    ["/privacy", 0.2, "yearly"],
    ["/terms", 0.2, "yearly"],
  ];
  return [
    ...pages.map(([path, priority, changeFrequency]) => ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency, priority })),
    ...products.map((p) => ({
      url: `${SITE.url}/product/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p.available ? 0.9 : 0.4,
    })),
  ];
}
