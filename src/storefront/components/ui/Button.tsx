"use client";

import Link from "next/link";
import type { ReactNode, MouseEventHandler } from "react";
import { IconArrow } from "./Icons";

type Variant = "primary" | "outline" | "gold" | "light";

type Props = {
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  "aria-label"?: string;
};

const styles: Record<Variant, { base: string; fill: string; hoverText: string }> = {
  primary: { base: "bg-ink text-cream", fill: "bg-gold", hoverText: "group-hover:text-ink" },
  outline: { base: "border border-ink/25 text-ink", fill: "bg-ink", hoverText: "group-hover:text-cream" },
  gold: { base: "bg-gold text-ink", fill: "bg-ink", hoverText: "group-hover:text-cream" },
  light: { base: "bg-cream text-ink", fill: "bg-gold", hoverText: "group-hover:text-ink" },
};

/**
 * The brand's one button. A single fill wipes up from the bottom on hover —
 * the previous specular sheen was a second, undocumented effect competing
 * with it.
 */
export default function Button({
  href,
  onClick,
  variant = "primary",
  children,
  className = "",
  arrow = false,
  type = "button",
  disabled,
  ...rest
}: Props) {
  const s = styles[variant];
  const cls = `group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-chip px-7 py-4 text-cap font-bold uppercase tracking-[0.16em] transition-colors duration-500 ${s.base} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`;

  const inner = (
    <>
      <span
        aria-hidden
        className={`absolute inset-0 translate-y-[101%] rounded-chip transition-transform duration-[650ms] ease-[var(--ease-expo)] group-hover:translate-y-0 ${s.fill}`}
      />
      <span className={`relative z-10 transition-colors duration-500 ${s.hoverText}`}>{children}</span>
      {arrow && (
        <IconArrow
          aria-hidden
          className={`relative z-10 h-4 w-4 transition-all duration-500 group-hover:translate-x-1 ${s.hoverText}`}
        />
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={cls} onClick={onClick} {...rest}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      className={cls}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {inner}
    </button>
  );
}
