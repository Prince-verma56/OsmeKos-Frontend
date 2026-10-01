import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import FaqBrowser from "@/storefront/components/pages/FaqBrowser";
import CtaBand from "@/storefront/components/pages/CtaBand";
import { FAQS } from "@/storefront/lib/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about the OsmeKos Body Lotion, how to use it, delivery, returns and refunds.",
};

// FAQPage structured data so search engines can show these answers directly.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.flatMap((g) =>
    g.items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
  ),
};

export default function FaqPage() {
  return (
    <div className="pb-24 md:pb-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader
        eyebrow="Help centre"
        title={
          <>
            Questions, <em>answered.</em>
          </>
        }
        text="Everything about the lotion, using it, delivery and returns. Can't find it? We're a message away."
      />
      <section className="container-x mt-14 md:mt-20">
        <FaqBrowser />
      </section>
      <CtaBand
        eyebrow="Still stuck?"
        title={
          <>
            Talk to a <em>real person.</em>
          </>
        }
        text="Customer care is open Monday to Saturday, 10am to 6pm."
        primary={{ href: "/contact", label: "Contact us" }}
        secondary={{ href: "/shipping-returns", label: "Shipping & returns" }}
      />
    </div>
  );
}
