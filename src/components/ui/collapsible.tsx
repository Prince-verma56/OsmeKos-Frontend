'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '@/lib/cn';
import { Icon } from '../Icon';

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export function CollapsibleTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      className={cn(
        `group flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left
         text-sm font-medium text-foreground/85 transition-colors hover:text-foreground
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`,
        className
      )}
      {...props}
    >
      {children}
      <Icon
        name="chevronDown"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform
          group-data-[state=open]:rotate-180"
      />
    </CollapsiblePrimitive.CollapsibleTrigger>
  );
}
