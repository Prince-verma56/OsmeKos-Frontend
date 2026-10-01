import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/storefront/components/PageHeader";
import PolicyLayout, { type PolicySection } from "@/storefront/components/pages/PolicyLayout";
import CtaBand from "@/storefront/components/pages/CtaBand";
import { SITE } from "@/storefront/lib/site";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Dispatch within 24 hours, free shipping above ₹999, and easy returns on unopened products within 14 days.",
};

const SUMMARY = [
  ["24h", "Dispatch from New Delhi"],
  ["2–4 days", "Typical delivery time"],
  ["₹999+", "Free shipping"],
  ["14 days", "Returns on unopened items"],
];

const SECTIONS: PolicySection[] = [
  {
    id: "dispatch",
    title: "Dispatch",
    body: (
      <>
        <p>
          Orders are packed and dispatched from New Delhi within 24 hours on working days. Orders placed on a Sunday or a
          public holiday leave on the next working day.
        </p>
        <p>You&apos;ll receive a confirmation when you order and a tracking link by email and SMS once it ships.</p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "Delivery times",
    body: (
      <>
        <p>We deliver to PIN codes across India. Delivery usually takes:</p>
        <ul>
          <li><strong>Metro cities:</strong> 2 to 3 working days</li>
          <li><strong>Rest of India:</strong> 3 to 5 working days</li>
          <li><strong>Remote areas and the North East:</strong> up to 7 working days</li>
        </ul>
        <p>These are estimates from our courier partners. Weather, festivals and local restrictions can occasionally add a day or two.</p>
      </>
    ),
  },
  {
    id: "charges",
    title: "Shipping charges",
    body: (
      <ul>
        <li><strong>Orders of ₹999 and above:</strong> free shipping</li>
        <li><strong>Orders below ₹999:</strong> a flat ₹79</li>
        <li>All prices on the site include taxes. There are no charges at the door.</li>
      </ul>
    ),
  },
  {
    id: "cod",
    title: "Cash on delivery",
    body: (
      <p>
        Cash on delivery is available on most PIN codes. Please keep the exact amount ready. If a COD parcel is refused at
        the door, we may ask for prepaid payment on future orders.
      </p>
    ),
  },
  {
    id: "returns",
    title: "Returns",
    body: (
      <>
        <p>
          If you change your mind, you can return <strong>unopened products in their original packaging within 14 days</strong> of
          delivery. For hygiene reasons we can&apos;t accept products that have been opened or used.
        </p>
        <p>To start a return:</p>
        <ul>
          <li>Write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with your order number and the item you&apos;d like to return.</li>
          <li>We&apos;ll arrange a pickup where available, or share an address to send it to.</li>
          <li>Once the parcel reaches us and passes a quick check, we process your refund.</li>
        </ul>
      </>
    ),
  },
  {
    id: "damaged",
    title: "Damaged or wrong items",
    body: (
      <p>
        If your parcel arrives damaged, leaking or with the wrong product, write to us within <strong>48 hours of delivery</strong> with
        your order number and a photo. We&apos;ll send a replacement at no cost, or refund you in full if you prefer. You won&apos;t
        need to return the damaged item.
      </p>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    body: (
      <ul>
        <li><strong>Prepaid orders:</strong> refunded to the original payment method within 5 to 7 working days of approval.</li>
        <li><strong>Cash on delivery orders:</strong> refunded by UPI or bank transfer. We&apos;ll ask for your details by email.</li>
        <li>Shipping charges are refunded when the return is due to our error.</li>
      </ul>
    ),
  },
  {
    id: "cancellations",
    title: "Cancellations",
    body: (
      <p>
        Because we dispatch quickly, orders can be cancelled only before they ship. Call {SITE.phone} or email us as soon as
        possible. If it has already left, you can return it unopened once it arrives.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Need help?",
    body: (
      <p>
        Customer care is open {SITE.hours}. Call <a href={SITE.phoneHref}>{SITE.phone}</a>, email{" "}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>, or use our <Link href="/contact">contact form</Link>.
      </p>
    ),
  },
];

export default function ShippingReturnsPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Shipping & returns"
        title={
          <>
            Fast out the door. <em>Easy</em> if it isn&apos;t right.
          </>
        }
      />
      <div className="container-x mt-12 md:mt-16">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.6rem] bg-line md:grid-cols-4">
          {SUMMARY.map(([n, l]) => (
            <div key={l} className="bg-sand p-6 md:p-8">
              <p className="font-display text-4xl leading-none md:text-5xl">{n}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <PolicyLayout sections={SECTIONS} updated={SITE.policyUpdated} />
      <CtaBand
        eyebrow="Questions"
        title={
          <>
            Something <em>not covered?</em>
          </>
        }
        primary={{ href: "/contact", label: "Contact us" }}
        secondary={{ href: "/faq", label: "Browse the FAQ" }}
      />
    </div>
  );
}
