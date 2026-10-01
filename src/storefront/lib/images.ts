const ORIGINS = [process.env.NEXT_PUBLIC_API_URL ?? "", process.env.NEXT_PUBLIC_IMAGE_ORIGINS ?? ""]
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  })
  .filter((origin): origin is string => origin !== null);

export function showable(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    return ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

export const showableImages = (urls: string[] = []) => urls.filter(showable);
