import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

const SITE = "https://www.invotick.com";
const EFFECTIVE = "15 September 2026";
// TODO(owner): confirm this mailbox is real and read (same address as the Privacy Policy).
const CONTACT = "support@invotick.com";

const TITLE = "Terms of Use — Invotick";
const DESCRIPTION =
  "The terms for using the Invotick invoicing apps for Android and iPhone and the website: your account, your content, shared links, Premium subscriptions and ads.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "article",
    url: `${SITE}/terms`,
    siteName: "Invotick",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

const sections: LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreeing to these terms",
    body: (
      <p>
        These terms apply when you use the Invotick app for Android or iPhone, the web app and free invoice tool at
        www.invotick.com, or an invoice page we host (together, &quot;Invotick&quot;). By using Invotick you agree to
        them. If you do not agree, please do not use Invotick. Our <Link href="/privacy-policy">Privacy Policy</Link>{" "}
        explains how we handle your information.
      </p>
    ),
  },
  {
    id: "who",
    heading: "Who can use Invotick",
    body: (
      <p>
        You must be at least 13 years old, and old enough in your country to agree to these terms. If you use Invotick for
        a business, you confirm you are allowed to act for that business.
      </p>
    ),
  },
  {
    id: "account",
    heading: "Your account and guest use",
    body: (
      <>
        <p>
          You can use Invotick as a guest or with an account. Keep your sign-in details safe; you are responsible for what
          happens under your account.
        </p>
        <p>
          <strong>As a guest, your work is tied to your device.</strong> If you lose the phone or delete the app before you
          create an account, you may not be able to get your data back. Creating an account keeps your work safe and lets
          you use it on other devices.
        </p>
      </>
    ),
  },
  {
    id: "content",
    heading: "Your content",
    body: (
      <>
        <p>
          Everything you put into Invotick (your business details, clients, items, invoices, estimates and images) stays
          yours. You give us permission to store, copy, process and display it only as needed to run Invotick for you,
          for example to back it up, sync it, turn it into a PDF, or show it to the people you share it with.
        </p>
        <p>
          You are responsible for your content: that it is accurate and lawful, and that you have the right to include
          your clients&apos; details and any logos or images you add.
        </p>
      </>
    ),
  },
  {
    id: "documents",
    heading: "Invoices are your documents",
    body: (
      <ul>
        <li>
          Invotick is a tool for making documents. The invoices and estimates you create are issued by you, and Invotick
          is not a party to any sale, payment or dispute between you and your clients.
        </li>
        <li>
          Invotick does not give tax, legal or accounting advice. Check that tax rates, totals and the details on your
          documents are right for your country and your business before you send them.
        </li>
        <li>
          Currency conversions shown in the app use exchange rates from a third-party service. They are for information
          only and may not match the rate your bank uses.
        </li>
        <li>Recording a payment in Invotick does not move any money; it is a record you keep.</li>
      </ul>
    ),
  },
  {
    id: "links",
    heading: "Shared links",
    body: (
      <p>
        When you share an invoice or estimate as a link, anyone who has the link can open it. You decide who receives it.
        If you edit a shared document, a new link is created and the old one stops working.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Using Invotick fairly",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use Invotick for fraud, fake invoices, or anything illegal;</li>
          <li>send spam or harmful content through shared links;</li>
          <li>try to access other people&apos;s data or accounts, or our systems, without permission;</li>
          <li>disrupt, overload, copy, reverse engineer or resell Invotick, except where the law allows it;</li>
          <li>interfere with ads, for example by generating fake clicks or impressions.</li>
        </ul>
        <p>We may suspend or close an account that breaks these rules.</p>
      </>
    ),
  },
  {
    id: "premium",
    heading: "Premium and payments",
    body: (
      <ul>
        <li>
          Premium is sold as a subscription through Google Play on Android and through the Apple App Store on iPhone. The
          price and billing period are shown before you buy.
        </li>
        <li>
          Subscriptions renew automatically at the end of each period unless you cancel at least 24 hours before it ends.
          You can cancel at any time in your Google Play or App Store account settings; Premium stays on until the end of
          the period you paid for.
        </li>
        <li>
          Google and Apple handle payment and refunds under their own terms. Deleting the app or your Invotick account does
          not cancel a subscription.
        </li>
        <li>What Premium includes is described on the Premium screen in the app. Today its main benefit is removing ads.</li>
      </ul>
    ),
  },
  {
    id: "ads",
    heading: "Ads",
    body: (
      <p>
        The free version of the Android app shows ads, which is how we keep it free. Ads come from third parties (see the{" "}
        <Link href="/privacy-policy#ads">Privacy Policy</Link>). We are not responsible for what advertisers offer.
      </p>
    ),
  },
  {
    id: "free-tool",
    heading: "The free invoice tool on the website",
    body: (
      <p>
        Invoices made with the free tool on www.invotick.com are saved in your browser until you sign in and back them up.
        If you clear your browser data or change browsers before that, they may be lost.
      </p>
    ),
  },
  {
    id: "changes-service",
    heading: "Changes and availability",
    body: (
      <p>
        We keep improving Invotick, so features may change, be added or be removed. We try to keep Invotick available all
        the time, but we cannot promise it will never be interrupted, for example during maintenance or problems with our
        providers. The app keeps your work on your phone and syncs it when it can.
      </p>
    ),
  },
  {
    id: "third-party",
    heading: "Other companies' services",
    body: (
      <p>
        Invotick relies on services from other companies, such as Google, Apple and Meta. Your use of those services is
        also governed by their terms.
      </p>
    ),
  },
  {
    id: "ip",
    heading: "Our app and brand",
    body: (
      <p>
        The Invotick apps, website, templates, design and name belong to us. You may use them to create and share your own
        documents, but you may not copy or reuse them for any other purpose without our permission.
      </p>
    ),
  },
  {
    id: "ending",
    heading: "Ending your use",
    body: (
      <p>
        You can stop using Invotick and delete your account at any time; the{" "}
        <Link href="/privacy-policy#delete">Privacy Policy</Link> explains how. We may suspend or end your access if you
        break these terms or if we have to stop offering Invotick; where we can, we will give you notice and a chance to
        save your documents.
      </p>
    ),
  },
  {
    id: "disclaimer",
    heading: "No warranties and limits on our liability",
    body: (
      <>
        <p>
          Invotick is provided &quot;as is&quot;. To the extent the law allows, we do not promise that it will be free of
          errors or meet every need, and we are not liable for indirect losses, such as lost profits, lost data or lost
          business, arising from your use of Invotick.
        </p>
        <p>
          Nothing in these terms limits any right you have under the consumer laws of your country that cannot be
          limited by agreement.
        </p>
      </>
    ),
  },
  {
    id: "changes-terms",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms. We will change the effective date at the top, and for significant changes tell you in
        the app or by email before they take effect. If you keep using Invotick after that, the new terms apply.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    body: <p>Questions about these terms: {mail}.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      effectiveDate={EFFECTIVE}
      intro={
        <p>
          These terms are the rules for using Invotick. They are written in plain language; please read them, together
          with our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
      }
      sections={sections}
    />
  );
}
