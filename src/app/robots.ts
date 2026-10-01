import type { MetadataRoute } from "next";
import { SITE } from "@/storefront/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/cart", "/checkout"] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
