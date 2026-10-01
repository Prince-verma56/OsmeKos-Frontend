import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

const imageHosts = [apiUrl, ...(process.env.NEXT_PUBLIC_IMAGE_ORIGINS ?? "").split(",")]
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      const { protocol, hostname, port } = new URL(value);
      return { protocol: protocol.replace(":", "") as "http" | "https", hostname, port, pathname: "/**" };
    } catch {
      return null;
    }
  })
  .filter((pattern) => pattern !== null);

const nextConfig: NextConfig = {
  // NOTE: output: "standalone" is only for Docker/self-hosted deployments.
  // Vercel manages its own build output — do NOT use "standalone" here.

  images: {
    // Stated explicitly rather than relying on the default, so the intent is
    // recorded: AVIF first, WebP for older browsers.
    formats: ["image/avif", "image/webp"],
    // 75 for grid/gallery media, 85 for feature panels, 90 for the hero and
    // the bottle shot whose printed percentages must stay legible.
    qualities: [75, 85, 90],
    remotePatterns: imageHosts,
  },
};

export default nextConfig;
