"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { createContext, useContext, type ReactNode } from "react";
import { IconPlus } from "./Icons";

/**
 * Radix supplies the behaviour we were missing: aria-controls/labelledby
 * wiring, arrow-key navigation between items, and correct region semantics.
 * The look is entirely ours — none of shadcn's styling layer is imported,
 * because it is themed against the admin's token set, not the storefront's.
 *
 * Height animation is CSS against Radix's own --radix-accordion-content-*
 * variables, so it needs no JS measurement and is free under reduced motion.
 *
 * Wrap a run of items in <Accordion> so arrow keys move between them. A bare
 * <AccordionItem> still works on its own.
 */

/** True when an <Accordion> ancestor owns the Radix root. */
const Grouped = createContext(false);

export function Accordion({
  children,
  className = "",
  /** Titles of the items that start expanded. */
  defaultOpen = [],
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: string[];
}) {
  return (
    <Grouped.Provider value>
      <RadixAccordion.Root type="multiple" defaultValue={defaultOpen} className={className}>
        {children}
      </RadixAccordion.Root>
    </Grouped.Provider>
  );
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  /** Only honoured on a standalone item; grouped items are set on <Accordion>. */
  defaultOpen?: boolean;
}) {
  const grouped = useContext(Grouped);

  // The title is the value: unique within an accordion, and stable across
  // renders so defaultValue can name it.
  const item = (
    <RadixAccordion.Item value={title} className="border-t border-line last:border-b">
      <RadixAccordion.Header>
        <RadixAccordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left">
          <span className="font-semibold">{title}</span>
          <IconPlus
            aria-hidden
            className="h-5 w-5 shrink-0 transition-transform duration-500 ease-expo group-data-[state=open]:rotate-45"
          />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content className="acc-content overflow-hidden">
        <div className="pb-6 text-[15px] leading-relaxed text-ink-2">{children}</div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  );

  if (grouped) return item;

  return (
    <RadixAccordion.Root type="multiple" defaultValue={defaultOpen ? [title] : undefined}>
      {item}
    </RadixAccordion.Root>
  );
}
