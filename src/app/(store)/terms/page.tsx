import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/storefront/components/PageHeader";
import PolicyLayout, { type PolicySection } from "@/storefront/components/pages/PolicyLayout";
import { SITE } from "@/storefront/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use osmekos.com and buy OsmeKos products.",
};

const SECTIONS: PolicySection[] = [
  {
    id: "agreement",
    title: "About these terms",
    body: (
      <p>
        These terms apply when you use osmekos.com or place an order with <strong>{SITE.company}</strong>,{" "}
        {SITE.address.join(", ")}. By using the site or placing an order, you agree to them. Please also read our{" "}
        <Link href="/privacy">privacy policy</Link> and <Link href="/shipping-returns">shipping and returns policy</Link>, which
        form part of these terms.
      </p>
    ),
  },
  {
    id: "products",
    title: "Our products",
    body: (
      <>
        <p>
          We describe our products as accurately as we can, including their full ingredient lists. Colours and textures may
          look slightly different on your screen than in real life.
        </p>
        <p>
          Our products are cosmetics for external use only. They are not medicines and are not intended to diagnose, treat
          or cure any condition. Patch test before first use, avoid contact with the eyes, and stop using a product if
          irritation occurs.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "Prices and payment",
    body: (
      <ul>
        <li>All prices are in Indian Rupees and include applicable taxes.</li>
        <li>Shipping charges, if any, are shown at checkout before you pay.</li>
        <li>We accept UPI, debit and credit cards, and cash on delivery.</li>
        <li>If a product is listed at a clearly wrong price because of an error, we may cancel the order and refund you in full.</li>
      </ul>
    ),
  },
  {
    id: "orders",
    title: "Orders",
    body: (
      <p>
        Your order is an offer to buy. A contract is formed when we confirm it by email or SMS. We may decline or cancel an
        order, for example if a product is out of stock or a delivery address can&apos;t be served, and we will refund any
        payment in full.
      </p>
    ),
  },
  {
    id: "delivery",
    title: "Delivery, returns and refunds",
    body: (
      <p>
        Delivery timelines, return eligibility and refund timelines are set out in our{" "}
        <Link href="/shipping-returns">shipping and returns policy</Link>. Risk in the products passes to you on delivery.
      </p>
    ),
  },
  {
    id: "use",
    title: "Using the site",
    body: (
      <>
        <p>Please don&apos;t:</p>
        <ul>
          <li>Use the site for anything unlawful or fraudulent.</li>
          <li>Try to disrupt, hack or overload the site.</li>
          <li>Buy products for commercial resale without our written permission.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <p>
        The OsmeKos name, logo, product designs, photography and text on this site belong to {SITE.company}. You may not copy
        or reuse them without our written permission.
      </p>
    ),
  },
  {
    id: "reviews",
    title: "Reviews and messages",
    body: (
      <p>
        If you send us a review, you allow us to publish it on our site and channels with your first name and city. We may
        edit it for length but won&apos;t change its meaning. We won&apos;t publish reviews that are abusive or unlawful.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        Nothing in these terms limits your rights as a consumer under Indian law, including the Consumer Protection Act,
        2019. Beyond those rights, our total liability for any order is limited to the amount you paid for it, and we are not
        responsible for losses that were not reasonably foreseeable.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of India. Courts in New Delhi have jurisdiction over any dispute.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        We may update these terms from time to time. The version on this page at the time of your order applies to that
        order. Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or call {SITE.phone}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Terms of service"
        title={
          <>
            The fine print, <em>in plain words.</em>
          </>
        }
      />
      <PolicyLayout sections={SECTIONS} updated={SITE.policyUpdated} />
    </div>
  );
}
