import { cn } from '@/lib/cn';

export function Monogram({ className, title = 'OsmeKos' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 560 400" role="img" aria-label={title} className={cn('block fill-current', className)}>
      <path
        fillRule="evenodd"
        d="M195 2c108 0 195 89 195 198S303 398 195 398 0 309 0 200 87 2 195 2Zm0 20c-74 0-134 80-134 178s60 178 134 178 134-80 134-178S269 22 195 22Z"
      />
      <path d="M512 0h40L292 400h-42Z" />
      <path d="M318 222l60-17 174 195h-80Z" />
    </svg>
  );
}

export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-[17px]', md: 'text-[22px]', lg: 'text-[40px]' }[size];
  return (
    <span className={cn('inline-flex items-baseline font-display font-medium tracking-[0.02em] text-foreground', text, className)}>
      Osme<span className="text-foreground">Kos</span>
      <sup className="ml-0.5 font-sans text-[0.32em] font-medium tracking-wider text-muted-foreground">TM</sup>
    </span>
  );
}

export function Logo({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'stacked' | 'mark';
  className?: string;
}) {
  if (variant === 'mark') return <Monogram className={cn('h-6 w-auto', className)} />;
  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <Monogram className="h-16 w-auto text-foreground" />
        <Wordmark size="lg" />
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Monogram className="h-6 w-auto shrink-0 text-foreground" />
      <Wordmark size="sm" />
    </div>
  );
}
