"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/storefront/lib/gsap";
import { useCart } from "@/storefront/store/cart";
import { useBag } from "@/storefront/store/bag";
import { apiPost, errorText } from "@/storefront/lib/api";
import { formatPrice } from "@/storefront/lib/format";
import Button from "@/storefront/components/ui/Button";
import Reveal from "@/storefront/components/ui/Reveal";
import SplitReveal from "@/storefront/components/ui/SplitReveal";

const PAY = [
  { key: "UPI", label: "UPI" },
  { key: "CARD", label: "Card" },
  { key: "COD", label: "Cash on delivery" },
] as const;

type PayKey = (typeof PAY)[number]["key"];

type Placed = {
  orderId: string;
  orderNumber: string;
  paymentMethod: PayKey;
  total: number;
  payment: { keyId: string; razorpayOrderId: string; amount: number; currency: string } | null;
};

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function CheckoutPage() {
  const clear = useCart((s) => s.clear);
  const { lines: items, subtotal, shipping, total, hydrated } = useBag();
  const [pay, setPay] = useState<PayKey>("UPI");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!done) return;
      gsap.from(".ok-circle", { scale: 0, duration: 1.2, ease: "elastic.out(1, 0.5)" });
      gsap.from(".ok-check", { strokeDashoffset: 60, duration: 0.8, ease: "power2.out", delay: 0.3 });
      gsap.from(".ok-text", { y: 20, autoAlpha: 0, stagger: 0.1, duration: 1, ease: "expo.out", delay: 0.4 });
    },
    { scope: ref, dependencies: [done] },
  );

  const settle = (orderNumber: string) => {
    setDone(orderNumber);
    clear();
    window.scrollTo(0, 0);
  };

  const payOnline = (placed: Placed, who: { name: string; email: string; phone: string }) =>
    new Promise<void>((resolve, reject) => {
      if (!placed.payment) return reject(new Error("Razorpay did not answer. Your order is saved as unpaid."));
      const options: RazorpayOptions = {
        key: placed.payment.keyId,
        amount: Math.round(placed.payment.amount * 100),
        currency: placed.payment.currency,
        name: "OsmeKos",
        description: `Order ${placed.orderNumber}`,
        order_id: placed.payment.razorpayOrderId,
        prefill: { name: who.name, email: who.email, contact: who.phone },
        theme: { color: "#0f0e0c" },
        handler: (response) => {
          apiPost(`/checkout/${placed.orderId}/paid`, {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
            .then(() => resolve())
            .catch(reject);
        },
        modal: {
          ondismiss: () =>
            reject(new Error(`Payment was closed. Order ${placed.orderNumber} is saved and still waiting to be paid.`)),
        },
      };
      new window.Razorpay!(options).open();
    });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !items.length) return;
    setProblem(null);
    setBusy(true);

    const f = new FormData(e.currentTarget);
    const value = (name: string) => String(f.get(name) ?? "").trim();
    const who = {
      name: `${value("firstName")} ${value("lastName")}`.trim(),
      email: value("email"),
      phone: value("phone"),
    };

    try {
      if (pay !== "COD" && !(await loadRazorpay())) {
        throw new Error("The payment window could not load. Check your connection, or choose cash on delivery.");
      }

      const placed = await apiPost<Placed>("/checkout", {
        email: who.email,
        phone: who.phone,
        paymentMethod: pay,
        shippingAddress: {
          firstName: value("firstName"),
          lastName: value("lastName"),
          phone: who.phone,
          email: who.email,
          line1: value("line1"),
          city: value("city"),
          state: value("state"),
          pincode: value("pincode"),
          country: "India",
        },
        lines: items.map((l) => ({ slug: l.slug, quantity: l.quantity })),
      });

      if (pay !== "COD") await payOnline(placed, who);
      settle(placed.orderNumber);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div ref={ref} className="container-x flex min-h-svh flex-col items-center justify-center py-32 text-center">
        <div className="ok-circle flex h-28 w-28 items-center justify-center rounded-full bg-gold">
          <svg viewBox="0 0 24 24" className="h-12 w-12 stroke-ink" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path className="ok-check" d="m5 12.5 4.5 4.5L19 7.5" strokeDasharray={60} strokeDashoffset={0} />
          </svg>
        </div>
        <h1 className="ok-text display mt-10 text-5xl md:text-7xl">Order <em>confirmed.</em></h1>
        <p className="ok-text lead mt-6 max-w-md">Order {done} is on its way. A confirmation has been sent to your email. Softer skin arrives in 2 to 4 days.</p>
        <div className="ok-text mt-10"><Button href="/" arrow>Back home</Button></div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-40">
      <div className="container-x pt-[130px] md:pt-[160px]">
        <Reveal><p className="eyebrow">Checkout</p></Reveal>
        <SplitReveal as="h1" className="display mt-5 text-5xl md:text-7xl">Where should we <em>send it?</em></SplitReveal>
      </div>

      <form onSubmit={submit} className="container-x mt-14 grid gap-14 lg:grid-cols-12">
        <div className="flex flex-col gap-12 lg:col-span-7">
          <Reveal>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.25em]">Contact</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input className="input" required name="email" type="email" placeholder="Email" autoComplete="email" />
              <input
                className="input"
                required
                name="phone"
                type="tel"
                placeholder="Phone"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                title="A 10-digit Indian mobile number"
                autoComplete="tel-national"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.25em]">Shipping address</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input className="input" required name="firstName" placeholder="First name" autoComplete="given-name" />
              <input className="input" required name="lastName" placeholder="Last name" autoComplete="family-name" />
              <input className="input md:col-span-2" required name="line1" placeholder="Address" autoComplete="street-address" />
              <input className="input" required name="city" placeholder="City" autoComplete="address-level2" />
              <input className="input" required name="state" placeholder="State" autoComplete="address-level1" />
              <input className="input" required name="pincode" placeholder="PIN code" inputMode="numeric" pattern="[1-9][0-9]{5}" autoComplete="postal-code" />
              <input className="input" value="India" readOnly />
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.25em]">Payment</h2>
            <div className="mt-5 flex flex-col gap-3">
              {PAY.map((p) => (
                <label key={p.key} className={`flex cursor-pointer items-center justify-between rounded-xl border px-5 py-4 transition-colors ${pay === p.key ? "border-ink bg-white/70" : "border-ink/15"}`}>
                  <span className="text-[15px]">{p.label}</span>
                  <input type="radio" name="pay" checked={pay === p.key} onChange={() => setPay(p.key)} className="accent-ink" />
                </label>
              ))}
            </div>
          </Reveal>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="sticky top-28 rounded-[2rem] bg-sand p-8">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.25em]">Your order</h2>
            <ul className="mt-6 flex flex-col gap-4">
              {hydrated && items.map((line) => (
                <li key={line.slug} className="flex items-center gap-4">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                    {line.image && <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />}
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-cream">{line.quantity}</span>
                  </div>
                  <span className="flex-1 text-sm">{line.name}</span>
                  <span className="text-sm tabular-nums">{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
              {hydrated && items.length === 0 && <li className="text-sm text-muted">Your bag is empty.</li>}
            </ul>
            <dl className="mt-6 flex flex-col gap-3 border-t border-ink/15 pt-6 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div>
              <div className="flex justify-between border-t border-ink/15 pt-4 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
            </dl>
            {problem && <p className="mt-5 rounded-xl bg-white/70 p-4 text-[13px] text-red-700">{problem}</p>}
            <Button type="submit" className="mt-8 w-full" arrow disabled={items.length === 0 || busy}>
              {busy ? "Placing your order..." : pay === "COD" ? "Place order" : `Pay ${formatPrice(total)}`}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
