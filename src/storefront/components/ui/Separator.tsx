import { IconSparkle } from "./Icons";

export default function Separator() {
  return (
    <div className="flex flex-col items-center justify-center bg-cream pb-12 pt-6">
      {/* A premium, fading vertical hairline to connect sections */}
      <div className="h-24 w-px bg-gradient-to-b from-transparent via-gold to-transparent opacity-60" />
      <IconSparkle className="mt-4 h-6 w-6 text-gold opacity-80" />
      <div className="mt-4 h-24 w-px bg-gradient-to-b from-transparent via-gold to-transparent opacity-60" />
    </div>
  );
}
