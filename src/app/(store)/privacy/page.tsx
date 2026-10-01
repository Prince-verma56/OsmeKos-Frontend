import type { Metadata } from "next";
import PageHeader from "@/storefront/components/PageHeader";
import PolicyLayout, { type PolicySection } from "@/storefront/components/pages/PolicyLayout";
import { SITE } from "@/storefront/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How OsmeKos collects, uses and protects your personal data.",
};

const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

const SECTIONS: PolicySection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        This website is run by <strong>{SITE.company}</strong>, {SITE.address.join(", ")} (&ldquo;OsmeKos&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;). This policy explains what personal data we collect when you use osmekos.com or buy from us, why we
        collect it, and the choices you have. We process personal data in line with India&apos;s Digital Personal Data
        Protection Act, 2023.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We only collect what we need to sell you products and support you:</p>
        <ul>
          <li><strong>Order details:</strong> your name, email, phone number and delivery address.</li>
          <li><strong>Payment:</strong> handled by our payment partners. We never see or store your full card or UPI details.</li>
          <li><strong>Messages:</strong> anything you send us by email, phone or the contact form.</li>
          <li><strong>Newsletter:</strong> your email address, only if you sign up.</li>
          <li><strong>Technical data:</strong> basic device and browser information needed to run the site securely.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To process, ship and track your orders, and to handle returns and refunds.</li>
        <li>To reply to your questions and provide customer care.</li>
        <li>To send order updates by email and SMS.</li>
        <li>To send our newsletter, only if you have subscribed. You can unsubscribe from any email.</li>
        <li>To prevent fraud and meet our legal, tax and accounting obligations.</li>
      </ul>
    ),
  },
  {
    id: "storage",
    title: "Cookies and local storage",
    body: (
      <>
        <p>
          Your shopping bag is saved in your browser&apos;s local storage so it&apos;s still there when you come back. It stays on
          your device and is not sent to us until you check out. You can clear it at any time from your browser settings.
        </p>
        <p>We do not use advertising or cross-site tracking cookies.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We never sell your personal data. We share it only with the partners who help us serve you:</p>
        <ul>
          <li>Payment gateways, to take payment securely.</li>
          <li>Courier partners, to deliver your order.</li>
          <li>Email and SMS providers, to send order updates.</li>
          <li>Authorities, where the law requires it.</li>
        </ul>
        <p>Each partner may use your data only to provide their service to us.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep order records for as long as tax and accounting law requires. Other data, such as newsletter subscriptions
        and support messages, is deleted when it is no longer needed or when you ask us to delete it.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask us at any time to:</p>
        <ul>
          <li>Tell you what personal data we hold about you.</li>
          <li>Correct or update it.</li>
          <li>Delete it, where we&apos;re not legally required to keep it.</li>
          <li>Stop sending you marketing emails.</li>
        </ul>
        <p>Write to {mail} and we&apos;ll respond within the time the law allows.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        The site is served over HTTPS, and access to customer data is limited to the people who need it to fulfil orders.
        No system is perfectly secure, but we take reasonable steps to protect your data and will tell you if a breach
        affects you.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Our products and website are intended for adults. We do not knowingly collect data from anyone under 18.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We may update this policy as our services change. The date at the top of this page shows the latest version.</p>,
  },
  {
    id: "grievance",
    title: "Contact and grievances",
    body: (
      <p>
        For any privacy question or complaint, contact our grievance officer at {mail} or {SITE.phone}, or write to{" "}
        {SITE.company}, {SITE.address.join(", ")}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Privacy policy"
        title={
          <>
            Your data, <em>respected.</em>
          </>
        }
        text="Plain language, no surprises. We collect only what we need to get your order to you."
      />
      <PolicyLayout sections={SECTIONS} updated={SITE.policyUpdated} />
    </div>
  );
}
