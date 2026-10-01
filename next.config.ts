import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function devLogin() {
  if (process.env.NODE_ENV === "production") return {};
  let email = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL ?? "";
  let password = process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? "";
  try {
    const backendEnv = fs.readFileSync(path.join(__dirname, "..", "backend", ".env"), "utf8");
    const read = (key: string) =>
      backendEnv.match(new RegExp(`^${key}=\\s*"?([^"\\r\\n]*)"?`, "m"))?.[1]?.trim() ?? "";
    email ||= read("SEED_ADMIN_EMAIL");
    password ||= read("SEED_ADMIN_PASSWORD");
  } catch {}
  return {
    NEXT_PUBLIC_DEV_LOGIN_EMAIL: email,
    NEXT_PUBLIC_DEV_LOGIN_PASSWORD: password,
  };
}

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
  // Emits .next/standalone — a self-contained server with only the
  // node_modules the import graph actually reaches. REQUIRED by the
  // Dockerfile, which copies .next/standalone. Changes no routing or
  // runtime behaviour.
  output: "standalone",

  // Two lockfiles exist above this directory, so Next guesses the repo root and
  // warns on every build. The app's root is this folder; say so.
  turbopack: { root: __dirname },

  agentRules: false,
  env: devLogin(),
  images: {
    // Stated explicitly rather than relying on the default, so the intent is
    // recorded: AVIF first, WebP for older browsers.
    formats: ["image/avif", "image/webp"],
    // 75 for grid/gallery media, 85 for feature panels, 90 for the hero and
    // the bottle shot whose printed percentages must stay legible.
    qualities: [75, 85, 90],
    remotePatterns: imageHosts,
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
