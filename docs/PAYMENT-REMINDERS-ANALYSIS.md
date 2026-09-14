# Payment reminders: analysis of the owner's goal (2026-09-14)

**The goal, in the owner's words (2026-09-14, translated).** "From the sender's side, a message to pay should go
automatically to all the clients whose payment is due. We can send this message on WhatsApp, and also directly in the
app."

**Status:** analysis only. Nothing is built.
- It builds on 0097, the "On Invotick" tag.
- How "paid" is known belongs to the owner's review of the Payments form, postponed on 2026-09-13
  (`memory/payment-form-review-postponed.md`). Nothing here changes that screen or its logic.

## In short

- **"Due" today mostly means "no payment was written down".**
  - 95% of real invoices whose due date has passed read as unpaid: 5,919 of 6,244.
  - Only 7% have any payment recorded.
  - Many were probably paid in cash and never recorded, so a fully automatic message would chase those clients. That
    is the biggest risk here, and it is a trust risk (G3).
- **So the first version should be one tap by the sender, not automatic.**
  - The app finds what is due and writes the message, with today's balance and the link.
  - The sender presses send in their own WhatsApp.
  - It is free, needs nothing from Meta, and works without the client's number on file.
- **A truly automatic WhatsApp message goes through Meta's business platform.** It needs:
  - each client's consent to hear from the business that sends;
  - approved message templates;
  - the client's number on file, which 14% of overdue invoices have;
  - a fee per message: about 1.5 US cents to a Pakistani number from 1 October 2026.
- **Meta's rules prohibit debt collection.**
  - Overdue reminders sent by one platform for many businesses could be read that way.
  - That is one more reason for each sender to send from their own number (§3B).
- **In the app it reaches 1 of 955 clients today.** That is 0097's reach problem, and it grows only as receivers are
  linked.
- **Order:**
  1. tap-to-send, after 1.4.6;
  2. in the app, with 0097;
  3. automatic WhatsApp, only after the Payments review and a working consent step.
- **The goals:**
  - **G1:** a reminder brings the sender back to their own real invoice, and a payment recorded after it is G1's
    second proof (0006).
  - **G2:** every reminder takes the client to the invoice page, which carries "make your own invoice".
  - **G3:** a reminder for an invoice already paid, or with an old balance, is the failure to prevent.

## 1. How "due" is known today (from the code)

### The due date

- Every invoice has one. By default it is 7 days after the invoice is made (`CreateInvoiceViewModel.kt:568`). The
  server keeps it as a date (`invoices.due_date`).
- **Most invoices keep that default.**
  - 63% of real invoices past their due date are due exactly 7 days after their invoice date (3,928 of 6,244). So are
    52% of the overdue invoices in §2.
  - So "overdue" often measures our default, not terms the client agreed to.
  - That is one more reason for the sender to confirm before anything goes out.
- Late starts **the day after** the due date, counted in calendar days in the user's own time zone
  (`InvoiceStatusRule.kt`).
- 1,745 invoices had their invoice date and due date stored a day early. The server repaired them on 2026-09-14 (0093).
  A reminder a day early is exactly the mistake this feature must never make.

### The status

- The status saved on the invoice is trusted for two values only, **Draft** and **Cancelled**, because a person chose
  them.
- Everything else is worked out when a screen opens. One rule does it in the app (`InvoiceStatusRule.calculatedStatus`)
  and on the web (`src/lib/invoice-status.ts`, decision 0084):
  - **Paid:** the payments recorded against it cover the total;
  - **Overdue:** not paid, and past the due date;
  - **Partial:** some money paid, and not late yet;
  - **Unpaid** (the code calls it SENT): nothing paid, and not late yet.
- Nothing updates the saved status when a due date passes. There is no nightly job.
- **Two places still save "Paid" on the invoice, and the rule ignores both:**
  - the Payments screen, when a receipt pays an invoice in full (`PaymentFormViewModel.kt:254`);
  - the web's invoice form, whose Status menu offers Paid and Overdue (`InvoiceForm.tsx`).
- **22 invoices say Paid with no payment behind them.** Every screen shows them as unpaid, or as overdue once they are
  late. An automatic reminder would chase them.

### Payment records

- "Paid" is the sum of the invoice's live payment links (`invoice_payments`: the app's `InvoiceDao`, the web's
  `paidAmount`).
- Payments come from two places: the payment section inside the invoice form, and the Payments screen.
- **What the postponed review holds that matters here:**
  - **Drafts.** The Payments screen spreads one receipt over the client's unpaid invoices, drafts included
    (`calculatePaymentAllocation`; 35 live payments sit on live drafts, counted 2026-09-14). Money put on a draft
    leaves a real invoice short, so that invoice reads as unpaid.
  - **Deleted payments.** A deleted payment can still count as paid on the phone, because its link stays live. The
    server holds 0 such links (checked 2026-09-14), so this has not reached synced data.
- **This goal depends on that review for one answer: "is this invoice still unpaid?"** Until the review settles it,
  nothing goes out without the sender's say-so.

### What each surface shows

- **App:** these all use the rule:
  - the tags in the invoice list (Paid, Unpaid, Overdue, Partial);
  - the dashboard;
  - the client ledger;
  - the Analytics tab, from 1.4.6.
- **Web (live):** the dashboard and the invoice list, with the same rule.
- **The share link, `/i/{token}`:**
  - it shows the invoice itself, with its due date, amount paid and balance due, plus Approve and Decline;
  - those numbers are frozen when the link is made (invariant 4), and the page never says "overdue";
  - so a reminder pointing to an old link would show an old balance. **A reminder needs a fresh link.**

### Is there a reminder feature already? Yes, for the sender only, and it is switched off.

- **What it does:** two notifications on the sender's own phone, per invoice (`ScheduleRemindersUseCase`,
  `ReminderWorker`). It never contacts the client.
  - "Payment Due Soon": 1, 3, 7 or 14 days before the due date.
  - "Payment Overdue": the day after it.
- **It is off.** The day picker has been commented out since 2026-06-08 (`161a9d10`), so no invoice gets a reminder.
- **It is planned as a paid feature.**
  - `PremiumFeature.PAYMENT_REMINDER` says "Watch a short ad to set a payment reminder".
  - The monetisation plan (the app's `docs/monetization-strategy.md`) gives one reminder per rewarded ad, and unlimited
    reminders with premium.
  - The gate is defined, but nothing uses it yet.
- **The paywall already sells it.**
  - Premium lists "Payment Reminders: Auto follow-ups for unpaid invoices" (`PremiumPaywallSheet.kt:922`, in 1.4.5
    and 1.4.6).
  - No build does that.
  - A promise the app does not keep is a trust problem (G3). It is a question for the owner, with the billing agent
    (see the decisions).
- **Two faults, if it comes back:**
  - it fires without checking that the invoice is still unpaid;
  - only a saved "Paid" cancels it. A payment entered in the invoice form does not.
- **Its event, `reminder_notification_shown`,** is in the catalogue, but no code sends it.
- **There is no reminder anywhere else:** not on the server, the web or the admin panel.
- **What exists and can be reused:**
  - **The share path.** The app sends the link through the phone's share sheet (`WhatsAppHelper.shareText`). A
    `wa.me` helper, `openWhatsApp`, exists, but nothing calls it.
  - **Server push.** It reaches all of a user's Android phones through Google's push service, FCM
    (`PushNotificationService.sendToUser`). It already tells the sender "approved", "declined" and "viewed". The
    phones' addresses live in `users.notification_tokens`.
  - **The receiver's side.** The "Received Invoices" list and the invoice view with Approve and Decline
    (`feature/receivedInvoice`), on Android and iPhone. The list lives only on the phone: a row appears when the
    receiver opens a link.

## 2. Production numbers (read-only, 2026-09-14 10:27 UTC)

- **The window:** due date from 16 June to 13 September 2026. That is 90 days, both ends fixed.
- **Real:** not deleted, not a draft or cancelled, and a total above zero.
- **Unpaid:** the app's rule. The payments recorded are less than the total.
- **Our four test accounts are left out** (91 invoices).
- Counts only. No user's values were read.

| | |
|:--|:--|
| **Invoices past due and unpaid, 90 days** | **2,271** |
| How late | 300 up to a week · 479 from 8 to 30 days · 1,492 from 31 to 90 days |
| Falling due each month | 779 in the last 30 days, 120 of them with a client phone, from 285 senders |
| With some payment recorded | 40 |
| Saved as Paid anyway | 4 |
| Due date left at the default 7 days | 1,186 (52%). 154 more were due the day they were made |
| **Senders** | **450**: 417 guests, 33 registered |
| Made an invoice in the last 30 days | 265 |
| Can receive a server push | 283 |
| How concentrated | 11 senders hold 1,511 invoices (two thirds). 325 senders have just one |
| Invoice currency | Myanmar kyat 1,205 (6 senders) · Pakistani rupee 568 (203 senders) · Rwandan franc 85 · US dollar 80 · Indian rupee 39 |
| **Clients** | **955** |
| With a phone number (10+ digits) | 148 (15%): about 46 Pakistani, 48 Myanmar, 54 other |
| With an email | 25 (3%). 19 have both |
| With neither | 801 (84%) |
| Invoices whose client has a phone | 318 (14%), from 58 senders |
| Invoices with a share link | 172 (links are kept only from 10 July). 94 were opened. The client approved 29 and declined 3 |
| Clients who are verified Invotick users | 1, with no push token |

**All time, for context:**

| | |
|:--|:--|
| Real invoices whose due date has passed | 6,244 |
| Unpaid by the rule | 5,919 (95%) |
| With any payment recorded | 445 (7%) |
| Unpaid, due before 16 June | 3,648, from 920 senders |

**What the numbers say:**
- **Unpaid mostly means unrecorded.** 95% of invoices past their due date read as unpaid, and only 7% have any payment
  written down. Many clients probably paid in cash. So nothing may go out by itself until "paid" can be trusted, and
  that is the Payments review.
- **Automatic sending needs the number on file.** Only 318 invoices have one. Tap-to-send does not: the sender picks
  the chat inside WhatsApp, as they do when sharing today.
- **The in-app channel reaches 1 client today.**
- **Pakistan has the most senders, Myanmar the most invoices.** Six senders invoicing in kyat hold over half of them.
  Message prices differ by the client's country.
- **Day one matters.** An "automatic" switch would find 5,919 old unpaid invoices at once. Only invoices that fall due
  after launch should be reminded without the sender picking them.
- **29 approved but unpaid invoices are the clearest case for a reminder:** the client already said yes.

## 3. WhatsApp and SMS: what "automatic" can honestly mean

### A. The sender taps send (free)

- **How:** the app opens WhatsApp with the message already written.
  - It goes through the phone's share sheet, today's share path
    ([Android](https://developer.android.com/training/sharing/send)), or through a `wa.me` link
    ([WhatsApp Help](https://faq.whatsapp.com/5913398998672934)).
  - The sender presses send in their own WhatsApp.
  - It works the same way on iPhone.
- **Cost:** nothing. There is no approval, no template and no consent step, because it is the sender's own chat with
  their own client.
- **Reach:** any client the sender can message on WhatsApp. The number does not have to be in Invotick: through the
  share sheet, the sender picks the chat inside WhatsApp.
- **Trust:** the client sees their supplier's own name and number, not ours.
- **What "automatic" means here:**
  - the app finds what is due, writes the message with today's balance and a fresh link, and puts it one tap away;
  - the tap is on the invoice list, and in the sender's own reminder notification;
  - the press is always the sender's.
- **It cannot be more automatic than that.**
  - WhatsApp's terms forbid bulk and automatic messaging through its apps
    ([Terms](https://www.whatsapp.com/legal/terms-of-service)).
  - Building an app that works with the WhatsApp Business service needs WhatsApp's written consent
    ([Business Terms](https://www.whatsapp.com/legal/business-terms)).
  - The block is WhatsApp's, not Play's.
  - Play also requires that the user confirm the words and the recipients of any message an app sends for them
    ([Play](https://support.google.com/googleplay/android-developer/answer/9899034)).

### B. Meta's WhatsApp Business Platform (paid, truly automatic)

- **What it is:** our server sends the message through Meta, with no tap. It is the only way WhatsApp allows automatic
  sending.

**The price** is per delivered message, by the client's country. Source: the rate cards effective 1 July and 1 October
2026 on [Meta's pricing page][wa-pricing], read on 2026-09-14.

[wa-pricing]: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

| Client's country | Utility (a payment reminder) | Marketing |
|:--|:--|:--|
| Pakistan | US$0.0100 now, **US$0.0150 from 1 October 2026** | US$0.0473 |
| Myanmar (Meta's "Other" group) | US$0.0077 | US$0.0604 |

- **Prices move.**
  - Pakistan's utility price rose from US$0.0054 in April 2026 (a secondary source), and rises again in October.
  - Meta may change prices on the first day of each quarter.
- **Replies may be charged too.** From 1 October 2026, replies sent within 24 hours of a client's message are charged,
  after the first 1,000 a month per number. A second read of Meta's page did not show this change, so check it again
  before building.
- **A reminder counts as "utility" if it carries no promotion.**
  - Meta's own utility examples include a payment reminder.
  - Meta decides at review, and a template that mixes in promotion counts as marketing
    ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)).
  - Templates are reviewed automatically, within 24 hours.
- **Consent** ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)):
  - the client must agree to receive messages from the business, and the agreement must name that business;
  - it need not mention WhatsApp, and the business chooses how to collect it. A tick on our share page would do;
  - it must also follow local law.
- **Quality and limits:**
  - Meta rates each number on the last 7 days of blocks and reports
    ([Meta](https://www.facebook.com/business/help/896873687365001)).
  - Penalties climb from a warning, to a 1- or 3-day block on templates, to a 5-, 7- or 30-day block on all messages,
    then a lock, then removal
    ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement)).
  - A business can message 250 different people a day at first, and 2,000 once verified. After that come 10,000,
    100,000 and unlimited. Every number the business owns shares that one limit
    ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).
- **Who sends: two models.**
  - **One Invotick number for every sender.** No Meta page allows it or forbids it. What speaks against it:
    - a number has one display name, which must represent the business that sends
      ([Meta](https://www.facebook.com/business/help/757569725593362)). The client would see "Invotick", not their
      supplier;
    - the consent must name the business, so each client would have to agree to hear from Invotick;
    - one sender's blocks and reports would lower the rating, and then the limits, for every sender.
  - **Each sender's own number.** This is Meta's documented model, called Embedded Signup
    ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)):
    - each business has its own WhatsApp business account and number, and pays Meta itself;
    - Invotick becomes a "Tech Provider", which needs a Meta app, business verification and Meta's app review;
    - we can bring on 10 businesses a week until we are verified, then 200;
    - version 2 of the signup is retired on 15 October 2026, so a build starts on the current version;
    - since February 2025, a sender can keep using the WhatsApp Business app on the same number. The app's messages
      stay free; only the platform's are billed;
    - it is heavy for our senders, because 417 of 450 are guests.
- **A risk to weigh: debt collection.** Meta's Business Messaging Policy lists debt collection among its prohibited
  uses, next to payday loans and bail bonds ([policy](https://www.whatsappbusiness.com/policy)).
  - A business reminding its own client about its own invoice is billing.
  - But one platform chasing overdue money for many businesses could be read as collection. That is our reading, not
    Meta's words, and Meta decides.
- **What "automatic" means here:** truly automatic. But it reaches only clients whose number is on file and who agreed
  to hear from the sending business. It uses approved, fixed words, costs a fee per message, and runs under Meta's
  quality rules.

### Costs at today's volume

These use Pakistan's utility price from 1 October 2026, before anyone declines consent. Myanmar's prices are a little
lower.

| | Messages | WhatsApp platform | SMS through Twilio |
|:--|:--|:--|:--|
| Each month: one reminder per new overdue invoice with a phone | 120 | about US$1.80 | about US$57 |
| Each month: up to three reminders each | 360 | about US$5.40 | about US$170 |
| Once: every overdue invoice of the last 90 days with a phone | 318 | about US$4.80 | about US$150 |

- **The messages are cheap.** The real costs are the build, Meta's checks, the consent step and the trust risk.
- **An SMS costs about 30 times** a WhatsApp utility message.

### C. SMS

- **Sending automatically from the sender's phone is not allowed.**
  - Play gives the permission to send SMS only to the phone's default SMS app. Payment reminders are not one of its
    exceptions ([Play policy](https://support.google.com/googleplay/android-developer/answer/10208820)).
  - The app can only open the SMS app with the message filled in. The sender presses send, and it is free.
  - Pakistan's operators also block any phone that sends more than 150 SMS in 15 minutes, 250 in an hour or 750 in a
    day ([PTA, 2022](https://x.com/PTAofficialpk/status/1536587150870863873)).
- **Sending from our server is paid, per message.**
  - Twilio to Pakistan: US$0.4734 a message, with no Pakistani sender number
    ([Twilio](https://www.twilio.com/en-us/sms/pricing/pk)). Plivo charges US$0.26–0.47
    ([Plivo](https://www.plivo.com/sms/pricing/pk/)).
  - Twilio to Myanmar: US$0.4143 a message ([Twilio](https://www.twilio.com/en-us/sms/pricing/mm)). Neither Twilio
    page shows a date; both were read on 2026-09-14.
  - A local Pakistani provider charges about Rs 3.8–4.8 an SMS. It also needs a sender name approved by PTA, which
    takes 30–45 working days and costs Rs 5,000 a year ([SendPK](https://sendpk.com/pta-compliance.php); a provider's
    own page, not PTA's).
- **What "automatic" means here:** only from our server, and paid. At Twilio's Pakistan price, one SMS for each of
  the 318 invoices with a phone costs about US$150 per round.

## 4. In the app

- **Who:** clients linked to an account under 0097 who leave "Show that I'm on Invotick" on.
- **What they get:** a notification, and a row in the "Received Invoices" list. Both open the existing invoice view,
  with Approve and Decline.
- **Already built:**
  - the invoice view, with Approve and Decline and a note to the sender;
  - the push back to the sender after a decision;
  - server push to all of a user's phones (FCM).
- **New work:**
  - **The link** between a client row and the receiver's account (0097 steps 2 and 3).
  - **A record on the server** that a reminder went to an account. Today the list fills only from links the receiver
    opened on that phone.
  - **A push type** for a reminder, beside `invoice_decision`.
  - **A fresh link** at reminder time, so the balance is today's (invariant 4). The list points at the link, never at a
    copy (invariant 3).
- **iPhones:**
  - local notifications work, but server push needs Apple's push service, APNs, which is not set up yet (0097 step 5);
  - APNs needs a paid Apple developer account and a signing key made in it
    ([Apple](https://developer.apple.com/help/account/capabilities/communicate-with-apns-using-authentication-tokens/));
  - until then, the list fills when the app opens.
- **Android 13 and later:** notifications need the user's permission, and new installs start with them off
  ([Android](https://developer.android.com/develop/ui/views/notifications/notification-permission)). The app asks
  only when a sender sends an invoice (`SaveInvoiceViewModel.kt:179`).
  - A client who installed Invotick only to open an invoice has never been asked, so a push would not show.
  - The inbox needs its own moment to ask.
- **Reach today:** 1 of 955 clients. It is the right channel for later, not the one that collects money now.

## 5. Guardrails

### The sender stays in control

- Nothing goes out without the sender's say-so until the Payments review defines "paid".
- Before each send, the sender sees the invoice, the amount still owed and the words.
- "Already paid?" skips that reminder. Recording the payment stays with the existing screens, as their review decides.
- A "don't remind" switch for each client and each invoice.
- Old invoices are never sent in a batch. The sender picks them one by one.

### How often (proposed defaults)

- Not before the day after the due date, unless the sender asks.
- At most once a week per invoice, and three times in all.
- At most one message a day per client. One message lists all of that client's due invoices.
- Nothing automatic at night in the client's time, from 9 pm to 9 am.

### The receiver can say no

- **In the app:** "Show that I'm on Invotick" (0097), and "mute this sender".
- **On the share page:** "Don't send me reminders".
- **On Meta's platform:** every request to stop is honoured, and people are told how to stop
  ([policy](https://www.whatsappbusiness.com/policy)).

### Firm, not harassing

- Say who is asking (the sender's business), for which invoice, how much is still owed, and since when. Add the link.
  Say please.
- Never use threats, "final notice", late fees that are not on the invoice, shaming, or copying anyone else in.
- Offer a few fixed messages, in the invoice's language, Urdu and English.
  - On tap-to-send, the sender can edit them.
  - Automatic sending uses only approved, fixed words.
- **No advertising inside the message.** "Make your own invoice with Invotick" stays on the page the link opens. An
  advert would turn the reminder into marketing, both in Meta's categories and under the law.

### The law in Pakistan

- **PECA 2016, section 25, "Spamming"** ([Pakistan Code, consolidated 2025][peca]):
  - sending unsolicited information to someone without their permission is an offence;
  - anyone doing direct marketing must offer a way to unsubscribe;
  - unsolicited messages, or marketing with no way to unsubscribe: a fine of up to Rs 50,000 the first time, then
    Rs 50,000 to Rs 1 million each time;
  - harmful, fraudulent or misleading messages: up to 3 months in prison, or Rs 50,000 to Rs 5 million, or both;
  - section 2 defines "unsolicited information" as information sent for **commercial and marketing** purposes
    **against the recipient's explicit refusal**;
  - the 2025 amendment did not change section 25
    ([Act II of 2025](https://na.gov.pk/uploads/documents/679b243193585_457.pdf)).
- **What that means (not legal advice):**
  - a reminder from a business to its own client, about a real invoice, is not marketing;
  - it stops being safe the moment it carries an advert, or keeps coming after the client said stop;
  - so there are no adverts inside, and every "stop" is honoured.
- **Section 26, "Spoofing":** sending in someone else's name, to be believed genuine, is an offence. So every reminder
  goes out on the sender's own instruction, under their real business name.
- **SMS:** PTA's anti-spam rules bind the operators. A business name as sender needs PTA's approval, and the
  do-not-call list (text `reg` to 3627) blocks promotional messages
  ([PTA](https://www.pta.gov.pk/category/want-to-avoid-unwanted-ads-1024691611-2023-06-01)).
- **Pakistan has no data protection law in force**
  ([Chambers, 2026-03-10](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/pakistan); a
  secondary source). Our privacy policy still gets a line (0097).

[peca]: https://www.pakistancode.gov.pk/pdffiles/administrator6a061efe0ed5bd153fa8b79b8eb4cba7.pdf

### Store rules

- **Apple, 4.5.4:** a push must not be needed for the app to work, and must not carry sensitive personal information.
  Promotions need explicit consent in the app and an in-app way to switch them off
  ([Apple](https://developer.apple.com/app-store/review/guidelines/)).
  - So the lock-screen line names only the sender, for example "A payment reminder from Ali Traders". The amount
    opens inside the app, as the receiver analysis already says (`docs/RECEIVER-ON-INVOTICK-ANALYSIS.md`).
- **Apple, 4.5.3:** push must not be used for spam or unsolicited messages.
- **Google Play, Spam policy:** an app may not send a message for the user without letting them confirm the words and
  the recipients ([Play](https://support.google.com/googleplay/android-developer/answer/9899034)). Tap-to-send does
  exactly that.
- **Google Play, Ads policy:** ads appear only inside the app that serves them, and never imitate a system notification
  ([Play](https://support.google.com/googleplay/android-developer/answer/9857753)).

### Trust (G3)

- Never remind about a paid invoice, and never show an old balance.
- Never message a number the sender did not check, because a typed number can be wrong. Tap-to-send shows the chat
  before sending; automatic sending cannot.
- One bad sender must not hurt the others.
  - On one shared Invotick number, one sender's blocks and reports would lower the rating, and then the limits, for
    all of them (§3B).
  - Each sender's own number keeps the harm with that sender.
- Ads are untouched. Nothing here adds, removes or moves an ad.

## 6. Measurement

By the rules in `AGENTS-EVENTS.md`. The counts are from the user-journey agent, read-only:
- events that arrived from 15 August to 14 September 2026;
- release builds only;
- our own phones left out.

**What already measures part of this:**

| Source | 30 days | What it tells, and what it cannot |
|:--|:--|:--|
| `invoice_shared_success` | 430 shares from 260 phones. WhatsApp 366 (85%), SMS apps 6 | Which app the sender picked. Not which invoice, and not a reminder as opposed to a share |
| `shared_invoice` (a server table) | 364 links: 103 opened (28%), 24 approved, 1 declined | The truth for each link. But "opened" includes a sender opening their own link |
| `shared_invoice_page_view` (web, since 9 September) | 76 | What the page found. Not who opened it |
| `payment_added` | 0, ever | Nothing. "Paid after a reminder" has no event today |
| `notification_permission_*` | shown on 253 phones, allowed on 212, denied on 42 | Who was asked. It is asked only when a sender sends an invoice |
| A push received, shown or tapped | no event at all | 0097's "notifications opened" has no source yet |
| Any reminder event | 0 in 90 days | The old reminder cannot fire |

**New events:**
- **The sender's press:** the Remind button's own automatic id, one for each place it appears. No coded twin (§1.4,
  §1.11).
- **The hand-off to WhatsApp, SMS or another app.** It is the same fact as a share, so it is `invoice_shared_success`
  with a new parameter, `purpose=reminder`, and not a new name (§1.1). G1 still counts it, which is right.
  - Opening WhatsApp directly skips the phone's chooser, so nothing confirms the hand-off. Only the chooser path can be
    measured.
- **A reminder is also a row on the server,** like `markShared` today.
  - It shows the sender "reminded on …" and prevents a double send.
  - Events carry that row's id, never the link's token (§1.18).
- **Automatic sends** (Meta's platform, or push) are recorded by the server in its own table, not in analytics.
  - Each row holds the channel, manual or automatic, the provider's message id, and the status Meta or FCM reports
    (accepted, sent, delivered, read, failed).
  - A send never attempted is "skipped", with its reason (paid, muted, setting off, no phone, no push token). It is
    never "failed" (§1.19).
  - A Health Centre card reads the table.
- **On the receiver's phone.** These are coded events, because nothing is pressed.
  - `notification_received`, with `kind` and whether it could be shown (`blocked_by=permission|channel_off`). This
    needs data-only pushes: in the background, the system draws a normal notification and our code never runs.
  - `notification_opened`, with `kind`.
  - The inbox is a screen, so its views and taps are recorded automatically.
- **The receiver's reaction.** Add `via=link|push|inbox` and `reminder_id` to the existing `shared_invoice_opened`,
  `shared_invoice_page_view`, `shared_invoice_approved` and `shared_invoice_rejected`.
  - The web route accepts only fixed values (§1.17).
  - Without a marker in the reminder's link, its opens look the same as the first share's.
- **Mute and the setting.** The state lives on the server. The events are the switch's own automatic ids, with
  `to=on|off`.
- **Paid after a reminder:** no event. The server compares reminder rows with the invoice's paid state.

**The metrics:**
- **Headline: of the invoices that fell due each week, how many were reminded.** The rest are split by reason: no
  phone, muted, setting off, not sent.
  - *This waits for the Payments review,* because "due" means "not paid".
- **S1:** reminders by channel and by trigger, and the delivery rate of automatic sends.
- **S2:** reminder links opened within 72 hours. The baseline is 28% of links shared in 30 days.
- **S3:** approvals and installs per 100 reminders, against mutes and switch-offs, which are the trust cost. The
  baseline is 24 approvals from 364 links.
- **S4:** invoices paid within 14 days of a reminder, beside the same week's unreminded invoices.
  - *It is blocked twice:* the review owns "paid", and `payment_added` records nothing.
  - It also sees only the payments senders write down.
- **Always alongside:** if the planned ad gate is used, ad revenue, fill and views on the screens it touches (AGENTS.md
  §1).

**Traps:**
- **Two clocks.**
  - Phones stamp events with their own clock, some as late as 2027.
  - So "within 72 hours" is worked out from server times, and every window is bounded on both ends (§3.14).
- **iPhones.** No iPhone push until APNs, and no iPhone in the journey until the build after 17.
- **Old Android builds.** Events from builds up to versionCode 90 are refused silently. Web and iOS are exempt.
- **The denylist.** It is not applied in release builds today, so a reminder tap cannot be switched off from the panel.
- **WhatsApp.** Match it by its exact app ids (`com.whatsapp`, `com.whatsapp.w4b`, and the iOS share extension), never
  by part of a name (§1.16).

## 7. A phased plan (rough effort)

| Phase | What | Waits on | Rough effort |
|:--|:--|:--|:--|
| 0 | The owner's decisions below. The Payments review defines "paid" | the owner | no build |
| 1 | **Tap-to-send.** A Remind button on due invoices, the message with today's balance and a fresh link, then WhatsApp, the SMS app or the share sheet. With the caps and the events | 1.4.6 released | about 1–2 weeks in the app, 2–3 days on the web page |
| 2 | **The sender's own nudge comes back** as the trigger: "INV-12 for Ali is overdue. Send reminder". It checks that the invoice is still unpaid when it fires. The ad gate follows the owner's decision | the Payments review ("still unpaid") | about 1 week |
| 3 | **In the app** for linked clients: a push, and a row in Received Invoices | 0097 steps 2 and 3 | about 2–3 weeks, server and app |
| 4 | **Automatic WhatsApp** through Meta, from each sender's own number, for clients who agreed | the Payments review; Invotick approved as a Meta Tech Provider (verification, app review); a consent step | about 3–4 weeks, plus Meta's review time, plus about 1.5 US cents a message |
| 5 | **iPhone push** | APNs, from the owner's Apple account | about 1 week after APNs |
| later | **SMS from our server** | only if a market needs it | not estimated |

After each phase, measure (§6) before starting the next.

## The owner's decisions (later, one at a time)

- **Is the first version tap-to-send, with the sender pressing send?** Recommended: yes, after 1.4.6.
- **When does automatic sending through Meta start?** Recommended: only after the Payments review and a consent step.
- **Whose number sends on Meta's platform?** Recommended: each sender's own (Embedded Signup), first for the 11 senders
  who hold two thirds of the overdue invoices. Not one Invotick number (§3B).
- **Does a reminder sit behind the planned rewarded-ad gate, and is automatic sending premium-only?** Recommended: yes
  to both, with ad revenue, fill and views measured beside reminders sent and drop-off.
- **How often?** Recommended: once a week per invoice, three at most, and one message a day per client.
- **Which words?** Recommended: three fixed messages (a nudge, due today, overdue), in the invoice's language, Urdu and
  English.
- **What about old invoices?** Recommended: offer only those falling due after launch; older ones only when the sender
  picks them.
- **SMS?** Recommended: not now. Tap-to-send already opens the SMS app for free.
- **Does the sender's own reminder come back?** Recommended: yes, as the trigger, once it checks "still unpaid" when it
  fires.
- **What about the paywall's "auto follow-ups" line, which no build does?** Recommended: build phase 1 first so the line
  comes true. Meanwhile the billing agent checks the words, and any change is measured on sales.
- **How is a reminder counted?** Recommended: `invoice_shared_success` with `purpose=reminder`, sent through the phone's
  chooser, with a marker in the link.
