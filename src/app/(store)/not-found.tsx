import Button from "@/storefront/components/ui/Button";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-svh flex-col items-center justify-center text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-5 text-6xl md:text-8xl">Nothing <em>here.</em></h1>
      <p className="lead mt-6 max-w-sm">This page has absorbed completely. Let&apos;s get you back to something nourishing.</p>
      <Button href="/" className="mt-10" arrow>Back home</Button>
    </div>
  );
}
