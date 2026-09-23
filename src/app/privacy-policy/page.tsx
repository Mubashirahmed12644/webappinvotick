import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalTable, type LegalSection } from "@/components/legal/LegalPage";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Every factual line in this policy is taken from the apps as they are built, not from a template:
// the Android release branch (gradle/libs.versions.toml, composeApp/build.gradle.kts, the release
// manifest), the iOS project (Package.resolved, Info.plist, PrivacyInfo.xcprivacy), the backend
// (invotick-apis, stage) and this web app. When a library, permission or data flow is added or
// removed, change this page in the same release — a policy that lists a service the app no longer
// has (or misses one it has) is exactly what the old Google Sites page got wrong.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const SITE = "https://www.invotick.com";
const EFFECTIVE = "23 September 2026";
// Confirmed by the owner on 2026-09-15. It is the only way to reach us today, deletion included.
const CONTACT = "support@invotick.com";

const TITLE = "Privacy Policy — Invotick";
const DESCRIPTION =
  "How Invotick collects, uses and shares information in its Android and iPhone apps and on invotick.com, who our service providers are, and how to delete your account.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    type: "article",
    url: `${SITE}/privacy-policy`,
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
    id: "summary",
    heading: "The short version",
    body: (
      <ul>
        <li>We collect what you type into Invotick (your business, your clients, your invoices) so we can store, sync and share it for you.</li>
        <li>We collect usage and device information to keep the app working, fix crashes and understand which features are used.</li>
        <li>The free Android app shows ads. Our ad partners (Google AdMob, and Meta through AdMob) receive device identifiers to show and measure ads.</li>
        <li>We do not see your card details. Google Play and the Apple App Store handle payments.</li>
        <li>Anyone who has an invoice link you share can open that invoice.</li>
        <li>The current app no longer uploads your phone&apos;s contacts. Older Android versions did; see <a href="#contacts">Contacts</a>.</li>
        <li>You can ask us to delete your account and data at any time: {mail}.</li>
      </ul>
    ),
  },
  {
    id: "who-we-are",
    heading: "Who we are and what this covers",
    body: (
      <>
        <p>
          Invotick is an invoicing and estimates app for small businesses. Invotick is operated by{" "}
          <strong>Flixotech LLC</strong>, a company in the United States (&quot;we&quot;, &quot;us&quot;), which is
          responsible for your information under this policy. On Google Play, the Android app is published by Touchpedia
          LLC. This policy covers the Invotick app for Android, the Invotick app for iPhone, the web app and free
          invoice tool at <Link href="/">www.invotick.com</Link>, and the invoice pages we host when you share an
          invoice link.
        </p>
        <p>
          If you have a question about this policy or your data, write to {mail}.
        </p>
      </>
    ),
  },
  {
    id: "you-give-us",
    heading: "Information you give us",
    body: (
      <>
        <ul>
          <li>
            <strong>Account details.</strong> Your name, email address and password if you create an account, or your
            Google account&apos;s name and email if you sign in with Google. A phone number if you choose to add one. We
            store only a scrambled (hashed) form of your password, never the password itself.
          </li>
          <li>
            <strong>Guest use.</strong> You can use the app without an account. We then create a guest account with a
            random identifier (your Invotick ID) so your work can be backed up and later moved to an account you create.
          </li>
          <li>
            <strong>Your business details.</strong> Business name, address, email, phone, website, tax numbers, payment
            instructions and bank details you choose to print on your invoices.
          </li>
          <li>
            <strong>Your clients&apos; details.</strong> The names, emails, phone numbers and addresses of the people and
            businesses you invoice. You are responsible for having the right to add them; we store them only to produce
            your invoices and estimates.
          </li>
          <li>
            <strong>Your documents.</strong> Invoices, estimates, items and prices, taxes and discounts, payments you
            record, expenses, notes and terms.
          </li>
          <li>
            <strong>Images.</strong> Your logo, signature, stamp, invoice headers and backgrounds, and receipt photos you
            attach.
          </li>
          <li>
            <strong>Messages.</strong> If someone approves or rejects an invoice you shared, the note they write is
            passed to you. If you email us, we keep the conversation.
          </li>
        </ul>
        <p>
          The app keeps your data on your phone first, then backs it up to our servers so it is safe and available on
          your other devices.
        </p>
        <p>
          We expect what you give us to be accurate and to be yours to give — your own details, and details of clients
          you are entitled to invoice. We do not check it, and we cannot correct it for you; you can edit it in the app
          at any time, and please keep it up to date.
        </p>
      </>
    ),
  },
  {
    id: "automatic",
    heading: "Information collected automatically",
    body: (
      <ul>
        <li>
          <strong>Device information.</strong> Device model, operating system and version, app version, language,
          whether the app is in light or dark mode, and a device identifier created by the app.
        </li>
        <li>
          <strong>Usage information.</strong> Which screens you open and which buttons you press, and events such as
          &quot;invoice created&quot; or &quot;invoice shared&quot;, with the time they happened. These records describe
          what you did in the app, not the contents of your invoices.
        </li>
        <li>
          <strong>IP address and approximate location.</strong> Our servers see the IP address of each request. We use
          it to estimate your country and city (never your precise location) with IP location services. The app does
          not ask for GPS location.
        </li>
        <li>
          <strong>Crash and performance reports.</strong> When the app crashes or runs slowly, a report with the device
          state and the technical details of the error is sent to Firebase Crashlytics and Firebase Performance
          Monitoring.
        </li>
        <li>
          <strong>Notification token.</strong> If you allow notifications, a token from Firebase Cloud Messaging so we can
          tell you, for example, that a client opened or approved your invoice.
        </li>
        <li>
          <strong>Advertising information (Android).</strong> Ad requests, which ads were shown and clicked, what an ad
          earned, and your device&apos;s advertising ID. See <a href="#ads">Ads</a>.
        </li>
        <li>
          <strong>Cookies on the website.</strong> A sign-in cookie that keeps you signed in to the web app. The free
          invoice tool saves your invoices in your own browser&apos;s storage. We do not use advertising cookies on the
          website.
        </li>
      </ul>
    ),
  },
  {
    id: "permissions",
    heading: "Camera, photos, microphone and notifications",
    body: (
      <ul>
        <li>
          <strong>Camera and photos</strong> are used only when you choose to take or pick a picture (a logo, header,
          background or receipt) or to scan an Invotick ID code. Only the picture you choose is saved.
        </li>
        <li>
          <strong>Microphone and speech</strong> are used only when you tap to dictate invoice details. Your speech is
          turned into text by your phone&apos;s speech service (Google&apos;s on Android, Apple&apos;s on iPhone),
          under that company&apos;s own privacy terms. We receive only the resulting text you keep.
        </li>
        <li>
          <strong>Notifications</strong> are optional and can be turned off in your phone&apos;s settings.
        </li>
      </ul>
    ),
  },
  {
    id: "contacts",
    heading: "Contacts",
    body: (
      <>
        <p>
          <strong>Android app 1.4.6 and later, and the iPhone app.</strong> &quot;Import from contacts&quot; reads your
          phone&apos;s contacts only on the phone, so you can pick a client. Only the client you pick is saved, as part of
          your data. Nothing else from your contacts leaves your phone.
        </p>
        <p>
          <strong>Android app 1.4.5 and earlier.</strong> When you used &quot;Import from contacts&quot;, these versions
          also uploaded your phone&apos;s contact list (names, phone numbers and email addresses) to our servers, and
          kept a copy of it inside the app. We stopped this in version 1.4.6. When a phone updates to 1.4.6, the app
          deletes its own copy once. Until every phone has updated, older versions may still upload.
        </p>
        <p>
          Contact lists already received from older versions are stored on our servers. They are not shown to other
          users and are not used by any feature of the app. We will not use them for any new purpose without first
          updating this policy and, where the law requires it, asking for consent. To have the contact list uploaded
          from your phone deleted, write to {mail} from your account&apos;s email or with your Invotick ID.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "How we use information",
    body: (
      <ul>
        <li>To provide Invotick: create, store, back up and sync your documents, and produce invoice PDFs and links.</li>
        <li>To sign you in, keep your account secure and send you one-time codes by email.</li>
        <li>To show you whether a shared invoice was opened, approved or rejected.</li>
        <li>To check whether you have Premium, and to process purchases and renewals through Google Play or the App Store.</li>
        <li>To show ads in the free Android app, and to measure how our own advertising performs.</li>
        <li>To find and fix bugs and crashes, and to understand which features are used so we can improve them.</li>
        <li>To prevent abuse and fraud, and to comply with the law.</li>
      </ul>
    ),
  },
  {
    id: "ads",
    heading: "Ads",
    body: (
      <>
        <p>
          The free Android app shows ads served by <strong>Google AdMob</strong>. From version 1.4.6, <strong>Meta Audience
          Network</strong> can also compete, through AdMob, to fill those ad spaces. To choose, show and measure ads, and
          to prevent ad fraud, these partners collect information from your device, such as its advertising ID, IP
          address, device information and how you interact with ads. They may use it to show ads based on your interests,
          under their own policies:{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google</a>{" "}
          and{" "}
          <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta</a>.
        </p>
        <p>
          The Android app also includes Meta&apos;s <strong>Facebook SDK</strong>, which sends Meta app events such as the
          app being installed and opened, purchases made in the app and ad earnings, together with the advertising ID. We
          use this to measure the advertising we run for Invotick. It does not use Facebook login.
        </p>
        <p>
          You can reset or delete your advertising ID, or turn off interest-based ads, in your phone&apos;s settings
          (Settings → Google → Ads on most Android phones). Premium removes ads from the app.
        </p>
        <p>
          The iPhone app also shows ads served by Google AdMob. Before it can use your device&apos;s advertising ID, it
          asks the App Tracking Transparency permission Apple requires; if you say no, no advertising ID is used.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    heading: "Service providers we use",
    body: (
      <>
        <p>
          We share information with the companies below only so they can do their part of running Invotick. Each one
          handles data under its own privacy policy.
        </p>
        <LegalTable
          head={["Provider", "What it does for us", "Where it is used"]}
          rows={[
            ["Hostinger", "Hosts our servers and database, and sends our emails", "Apps, website"],
            ["Vercel", "Hosts the website and the preview images for shared invoice links", "Website, shared links"],
            ["Google Firebase (Analytics, Crashlytics, Performance Monitoring, Remote Config, Cloud Messaging)", "Usage analytics, crash and performance reports, remote app settings, notifications", "Android (all five); iPhone (Analytics, Crashlytics, Remote Config, Cloud Messaging)"],
            ["Google Sign-In", "Signing in with a Google account", "Android, iPhone, website"],
            ["Google AdMob", "Showing ads", "Android, iPhone"],
            ["Meta (Audience Network through AdMob, Facebook SDK)", "Showing ads (1.4.6 and later), measuring our advertising", "Android"],
            ["Google Play Billing / Apple App Store", "Taking payments for Premium", "Android / iPhone"],
            ["ip-api.com, ipinfo.io", "Estimating country and city from an IP address", "Our servers"],
            ["Google Drive", "Storing backup copies of our database", "Our servers"],
            ["UXCam", "Usage analytics: how the app's screens are used", "Older Android versions only (1.4.5 and earlier); removed in 1.4.6"],
          ]}
        />
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Shared invoice links",
    body: (
      <>
        <p>
          When you share an invoice or estimate as a link, we host a page for it. <strong>Anyone who has the link can open
          it</strong> and see what is on the document: your business details, your client&apos;s details, the items and
          totals, and your logo, signature and stamp. Share the link only with people who should see it.
        </p>
        <p>
          When the link is opened, we record that it was opened and on what kind of device (Android, iPhone or computer),
          so we can tell you. The person who opens it can approve or reject the invoice and write you a note. If you edit
          a shared invoice, a new link is created and the old one stops working.
        </p>
      </>
    ),
  },
  {
    id: "who-we-share-with",
    heading: "Who else we share information with",
    body: (
      <ul>
        <li>The service providers listed above.</li>
        <li>The people you choose to share an invoice or estimate with.</li>
        <li>Authorities, when the law requires it, or to protect the rights and safety of our users or of Invotick.</li>
        <li>A buyer or successor, if Invotick is sold or merged; this policy would continue to apply to your data.</li>
      </ul>
    ),
  },
  {
    id: "business-transfer",
    heading: "If Invotick changes hands",
    body: (
      <p>
        If Flixotech LLC is sold, merges with another company, or sells the part of the business that runs Invotick, the
        information covered by this policy — including your account, your documents and your clients&apos; details —
        would pass to the buyer or successor as part of that deal, along with anything shared with them beforehand to
        let them examine the business. This policy would keep applying to your data until you are told otherwise, and we
        would tell you in the app or by email before anything about it changed. If you would rather not have your data
        go with it, you can ask us to delete your account first: {mail}.
      </p>
    ),
  },
  {
    id: "payments",
    heading: "Payments",
    body: (
      <p>
        Premium is bought through Google Play on Android and through the Apple App Store on iPhone. Google and Apple take
        the payment; we never see or store your card number. We receive a record of the purchase (the product, the date,
        and whether it is active, renewed or cancelled) so we can turn Premium on for you.
      </p>
    ),
  },
  {
    id: "storage",
    heading: "Where information is stored",
    body: (
      <>
        <p>
          Your data is stored on your device and on our servers, which are run by Hostinger in the European Union
          (France). Some service providers, such as Google, Meta and Vercel, process data in other countries, including the
          United States. By using Invotick you understand that your information may be processed outside your country.
        </p>
        <p>
          When information leaves the European Union or the United Kingdom this way, we rely on the transfer terms those
          providers offer for it — usually the <strong>Standard Contractual Clauses</strong> approved by the European
          Commission, or an equivalent safeguard where the provider has one. If you want to know which safeguard covers
          a particular provider, write to {mail} and we will tell you.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep information",
    body: (
      <ul>
        <li>Your account and documents: for as long as your account exists.</li>
        <li>Guest data: on your phone until you delete the app, and on our servers until you ask us to delete it.</li>
        <li>Server logs: deleted automatically after a limited period.</li>
        <li>Backups: kept for a short rolling period, then replaced.</li>
        <li>After you delete your account, we erase your data as described below, except anything we must keep by law.</li>
      </ul>
    ),
  },
  {
    id: "delete",
    heading: "Deleting your account and data",
    body: (
      <>
        <p>
          <strong>By email, today.</strong> Write to {mail} from your account&apos;s email address, or include your
          Invotick ID if you use the app as a guest, and ask us to delete your account. We will close it and erase its
          data, including your documents, clients, images and any contact list uploaded from your phone, within 30 days.
        </p>
        <p>
          <strong>In the app.</strong> App versions that include it have <em>Menu → Account → Delete account</em>. Your
          account closes at once, and its data is erased after 30 days.
        </p>
        <p>
          Deleting your account does not cancel a Premium subscription; cancel it in Google Play or the App Store. Invoice
          links you shared stop working once your data is erased. Deleting the app from your phone removes the data on
          that phone, but not the copy on our servers.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    heading: "Your choices and rights",
    body: (
      <>
        <ul>
          <li>You can see and correct your details and documents in the app at any time.</li>
          <li>You can turn off notifications, camera, photo and microphone access in your phone&apos;s settings.</li>
          <li>You can reset your advertising ID or opt out of interest-based ads in your phone&apos;s settings.</li>
          <li>You can ask us for a copy of your data, to correct it, or to delete it, by writing to {mail}.</li>
        </ul>
        <p>Whatever country you are in, you can write to {mail} and ask us to:</p>
        <ul>
          <li>
            <strong>Show you your data</strong> — tell you what we hold about you and give you a copy of it.
          </li>
          <li>
            <strong>Correct it</strong> — fix anything that is wrong or out of date.
          </li>
          <li>
            <strong>Delete it</strong> — erase your account and its data, as described in{" "}
            <a href="#delete">Deleting your account and data</a>.
          </li>
          <li>
            <strong>Hand it over</strong> — give you your invoices, clients and other data in a file you can take to
            another service.
          </li>
          <li>
            <strong>Stop a particular use</strong> — object to our using your information for something, and we will
            stop unless we have to continue by law.
          </li>
          <li>
            <strong>Put a use on hold</strong> — keep your information but stop using it while a question about it is
            being settled.
          </li>
          <li>
            <strong>Take back a permission</strong> — withdraw anything you allowed, such as notifications, camera or
            photo access. This does not undo what was already done while the permission was on.
          </li>
          <li>
            <strong>Stop marketing email</strong> — we will still send the emails the service itself needs, such as
            sign-in codes.
          </li>
        </ul>
        <p>
          Some places give these rights a name in law — the <strong>GDPR</strong> in the European Union and the United
          Kingdom, the <strong>CCPA</strong> and <strong>CPRA</strong> in California, and <strong>PIPEDA</strong> in
          Canada, among others. You do not need to know which one covers you, or to quote it: write to {mail} and we
          will treat your message as a request under whichever rights you have. You may also complain to the data
          protection authority for your country or state. We do not sell your personal information for money. We will
          answer any request within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Traffic between the apps, the website and our servers is encrypted (HTTPS/TLS). Passwords are stored only in
        hashed form, and access to our servers is restricted. No system is perfectly secure, so we cannot promise that
        information will never be accessed without permission, but we work to protect it and will tell affected users
        where the law requires.
      </p>
    ),
  },
  {
    id: "third-party-links",
    heading: "Links to other websites",
    body: (
      <p>
        Invotick, this website and the invoice pages we host contain links to websites run by other companies — an app
        store, a payment or ad partner, or a link you or your client put on a document. Those websites are not ours. We
        do not control them and we are not responsible for what they do with your information, so please read the
        privacy policy of any site you open from here. This policy covers only Invotick.
      </p>
    ),
  },
  {
    id: "children",
    heading: "Children and minimum age",
    body: (
      <>
        <p>
          <strong>You must be at least 13 years old to use Invotick</strong>, and old enough in your country to agree to
          our <Link href="/terms">Terms of Use</Link>. Invotick is a business tool and is not meant for children.
        </p>
        <p>
          We do not knowingly collect information from children under 13. If you believe a child has given us
          information, write to {mail} and we will delete it.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We will update this page when the apps or our practices change, and change the effective date at the top. If a
        change is significant, we will also tell you in the app or by email before it takes effect.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    body: (
      <p>
        Questions, requests or complaints about privacy: {mail}. Our <Link href="/terms">Terms of Use</Link> explain the
        rules for using Invotick.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={EFFECTIVE}
      intro={
        <p>
          This policy explains what information Invotick collects when you use our apps and website, why we collect it,
          who we share it with, and the choices you have. It is written for the Invotick apps as they are today.
        </p>
      }
      sections={sections}
    />
  );
}
