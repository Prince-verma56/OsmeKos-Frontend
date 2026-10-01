"use client";

import { useState } from "react";
import Button from "@/storefront/components/ui/Button";
import { apiPost, errorText } from "@/storefront/lib/api";
import { SITE } from "@/storefront/lib/site";

const TOPICS = ["Order or delivery", "Returns and refunds", "Product question", "Wholesale or partnerships", "Something else"];

export default function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const value = (name: string) => String(f.get(name) ?? "").trim();

    setBusy(true);
    setProblem(null);
    try {
      await apiPost("/contact", {
        name: value("name"),
        email: value("email"),
        phone: value("phone") || undefined,
        topic,
        orderNumber: value("order") || undefined,
        message: value("message"),
      });
      setSent(true);
      form.reset();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">What is it about?</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-4 py-2 text-[13px] transition-colors duration-300 ${
                topic === t ? "border-ink bg-ink text-cream" : "border-ink/20 text-ink hover:border-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <input className="input" name="name" required placeholder="Your name" autoComplete="name" />
        <input className="input" name="email" type="email" required placeholder="Email" autoComplete="email" />
        <input className="input" name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" />
        <input className="input" name="order" placeholder="Order number (optional)" />
      </div>
      <textarea className="input min-h-40 resize-y" name="message" required placeholder="How can we help?" />

      <div className="mt-2 flex flex-wrap items-center gap-5">
        <Button type="submit" arrow disabled={busy}>
          {busy ? "Sending..." : "Send message"}
        </Button>
        <p className="text-[12.5px] text-muted">We usually write back within one working day.</p>
      </div>

      {problem && <p className="rounded-2xl border border-red-300 bg-white/60 p-4 text-[14px] text-red-700">{problem}</p>}

      {sent && (
        <p className="rounded-2xl border border-gold/40 bg-white/60 p-4 text-[14px] text-ink-2">
          Thank you, we have your message and will write back soon. You can also reach us at{" "}
          <a href={`mailto:${SITE.email}`} className="font-semibold text-ink underline decoration-gold underline-offset-4">
            {SITE.email}
          </a>{" "}
          or call{" "}
          <a href={SITE.phoneHref} className="font-semibold text-ink underline decoration-gold underline-offset-4">
            {SITE.phone}
          </a>
          .
        </p>
      )}
    </form>
  );
}
