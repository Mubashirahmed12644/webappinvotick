# Screens designed in the admin panel: analysis of the owner's idea (2026-09-14)

**The idea, in the owner's words (2026-09-14, translated).** Keep a free-standing WebView (a browser window inside
the app) in the app. We design what it shows in our admin panel, and set all its settings there too. It can show
whatever we want, and move the user through the app according to what they tap. The benefit: a user who becomes a
guest by mistake does not even know where their data went, so we show them a screen that is to the point.

**His example** was a sign-in screen with the id and password already filled in. It was answered separately:
- sign-in stays native, and the server keeps only a scrambled form of the password (a BCrypt hash), so no screen can
  fill it in;
- 1.4.6 fills in the email and puts the phone's password manager one tap away (0098);
- a renewal key will spare most forced sign-ins (0101).

**Status:** analysis only. Nothing is built. 0098 held the idea back for this analysis. Decisions will be logged from
0102 as the owner answers.

**Read for this analysis:** app `VC_102_VN_146` (`df88a516`), backend `stage` (`d916a6d`), panel `main` (`4e7a4ae`),
the web renderer in this repo, and production (read-only).

## The short answer

- **It can be built, and both stores allow it**, as long as the phone downloads data, never code, and a remote screen
  can never ask for a password or a payment.
- **The case that started it is rare today.** The server began recording which phone uses which account on
  2026-07-20. Since then, 8 phones went from a registered account to a guest. 7 of them are our own test phones, so at
  most 1 is a real user.
- **The recovery paths we know of are already being fixed natively in 1.4.6:**
  - the "sign in again" screen (0098), for about 17 accounts;
  - the one question when a guest signs in to an older account (0053), for 2 to 4 phones a week.
- **So the system has to earn its keep on the other uses:** onboarding, announcements and campaigns, which serve G1
  and G2. They change often, and that is when "no app release" pays.
- **Recommended:** the panel builds a screen from blocks (title, text, image, buttons), and the app draws the blocks
  with its own components.
  - A button may open a page on invotick.com in the WebView the app already has.
  - A free-form web page with a door into the app is the one shape to avoid.

## Today's numbers (production, read-only)

| | |
|:--|:--|
| Devices seen in 7 days | Android 2,899 · the web share page 79 · iPhone 3 (TestFlight) |
| Android devices by build, 7 days | 1.4.4: 1,741 · 1.4.5: 797 · 1.4.2: 741 (a phone that updated counts under both) |
| Accounts | 14,414 guests, 521 registered, 1 admin. 96.5% are guests |
| New accounts in 30 days | 3,326 guests, 129 registered |
| First-time devices that created an invoice, 09-02 → 09-09 (measured 09-09) | 287 of 1,360 (21.1%) |
| Phones that went from a registered account to a guest, since 2026-07-20 | 8: 7 are ours, 1 unknown |
| Guests who later signed in to an older account (0053, measured 09-13) | 3, 4 and 2 phones in the weeks to 08-30, 09-06 and 09-13 |
| Accounts with a push token | 2,233 guests (15%), 115 registered (22%) |
| Notification permission, 30 days | 274 devices asked: 230 allowed, 46 refused |

## 1. What already exists to build on

### The invoice renderer is the pattern to copy
- `Webinvotick/renderer/` builds the invoice renderer into one self-contained file of 1.4 MB. The app ships it twice:
  in Android's assets and in iOS's resources.
- Only data crosses the line. The app hands the invoice in (`window.__setInvoice(json)`). The page answers through a
  small bridge (a way for the page to call the app) for stamp drags and scrolling: `AndroidStamp` on Android, a
  message handler on iOS.
- This is the north star's own pattern (AGENTS.md §3, 0001): the drawing code ships inside the app, and the server
  sends only data. "Templates as data, added from the panel" is the same idea as this one.
- The north star is about the invoice document. It does not ask for app screens to be drawn in HTML.
- The two copies have already drifted once. On 2026-09-13 iPhones still ran the 08-24 copy and showed 5 Sep as 9 May.

### WebViews in the app today
- There are four:
  - the invoice renderer, kept warm in one WebView built at an idle moment after launch;
  - the shared-invoice page (`/i/{token}`);
  - the Preview's online tab (`/embed/render`);
  - a dialog that opens the privacy policy on sites.google.com.
- A fifth use prints a received invoice to PDF.
- **All of them force light mode**, on purpose: an invoice is paper. None follows the app's dark mode.
- **A WebView is heavy.** From the renderer's own notes:
  - it takes tens of MB of memory;
  - it costs about 0.25 s on a fast phone, and several times that for the first WebView a process builds.
- The one freeze (ANR) from the warm-up in 28 days fits that first build.
- On phones under 2 GB, 1 cold start in 10 already takes 6.7 s or more.

### Remote Config: a switchboard, not a design tool
- Firebase Remote Config runs on Android, and on iOS since 2026-08-24. Five iOS values were never saved until the fix
  of 2026-09-14.
- The app reads 21 keys: 16 for the app, and 5 for ads, 4 of which are JSON. They are fetched during the splash and
  kept on the phone.
- Kill switches (switches that turn a feature off for everyone without a release) are read as text. They are off only
  when they say so (`remoteSwitchIsOn`, with tests).
- It can target by app version, platform, country and language. Its limits are 3,000 keys and 1,000,000 characters of
  values per project.
- It is edited in Firebase's console, not in our panel. Debug and release builds read two separate projects.

### The panel already steers the app once
- A toggle in Event Discovery goes to the server's `GET /v2/analytics/denylist`, and the app applies it at every start
  (`App.kt`). No release is needed.
- That is the exact shape a remote screen needs: the panel decides, the server serves, and the app obeys.

### Can a remote screen open app screens? Yes, from a fixed list
- The app can already start its main shell at a named place (`MainShellLaunchDestination`): the invoice list, create
  invoice, a received invoice, or device link.
  - A request that arrives during the splash must go this way, because the shell's screens do not exist yet.
- Deep links (links that open a particular place in the app) read 7 destinations, but act on only 2: a received
  invoice and device link.
  - Home, invoice, client, expense and business links are read and then dropped (`AppViewModel.route`).
- So each screen a remote screen may open is a small piece of wiring, done once in the app.
- A remote screen can never open anything outside that list. That is the safety.

### Push
- Android only. The app knows two kinds: an approve or reject decision, and a silent "your client viewed it".
- Tapping a notification opens the app's front door, not a particular screen.
- The server sends to one user at a time (`sendToUser`), from 3 places: the shared invoice (2) and device link (1).
  Nothing can send to a group.
- iPhones get no push until APNs is set up.

### Firebase Analytics
- The app's event gateway also sends each event to Firebase Analytics. So Firebase In-App Messaging could trigger on
  our own event names.
- In-App Messaging itself is not in the app.

### The admin panel
- Admin sign-in has a one-time-code step.
- The backend has three roles (USER, GUEST, ADMIN) and 1 admin account. ADMIN is the only role that could publish.
- `app/m3.css` is the app's own colour table, the one `ColorSchemes.kt` ships, light and dark. A preview can use the
  app's real colours.
- A `testing-devices` page exists, but its list is stale: 10 ids, none active in the 30 days to 2026-09-13.
- A contrast checker exists (`tools/contrast-check.mjs`).
- The panel's invoice preview is its own set of components, not the web's renderer.

## 2. Three ways to build it

### A. HTML in a WebView, designed in the panel (the owner's idea)
There are two ways to do it:
- **A1, data only.** A second renderer file, built from `renderer/` like the invoice one, ships inside the app. The
  panel sends JSON. The page may call only a fixed list of actions through the bridge. This stays inside every store
  rule.
- **A2, a live page.** The app loads a page from invotick.com, with a bridge into the app. New designs need no
  release. But it is downloaded code with a door into the app, which is exactly where both stores draw lines (see
  §4, item 8). Not recommended.

Gains:
- any design, and a panel preview that is pixel-identical, because the panel can show the same renderer;
- one HTML engine for documents and screens.

Costs:
- the WebView's weight, at the moments these screens matter most: launch and first open;
- dark mode, large fonts, screen readers and right-to-left languages must be built into the page, and checked again
  for every screen;
- the app's automatic tap capture cannot see taps inside a page. So the bridge must report them through the same
  gateway (AGENTS-EVENTS §1.5);
- one more copy of a renderer to keep in step on two platforms.

Effort: about 4 weeks for a first version of A1.

### B. Blocks drawn by the app
This is often called "server-driven UI": the server sends a description, and the app draws it.
- The panel builds a screen from a few blocks: title, text, image, bullet list, one main button, one second button.
- It picks a container: a bottom sheet or a full screen.
- The server stores it as JSON. The app draws each block with its own components.

Gains:
- it looks and behaves like the rest of the app. Dark mode, large fonts, TalkBack and VoiceOver come free;
- there is no WebView, so nothing heavy happens at launch;
- taps are counted automatically, like every other button in the app;
- a screen is a few KB to keep offline;
- one shared code base draws it on Android and on iOS.

Costs:
- design is limited to the blocks, and a new kind of block needs an app release;
- the panel preview is close but not pixel-identical. So every screen goes to a test phone before it reaches users.

Effort: about 3 weeks for a first version.

### C. A ready-made service: Firebase In-App Messaging
- It costs nothing and runs on Android, iOS and Flutter.
- It offers cards, banners, pop-ups and images, targeted by Analytics audience, version, country and language.
- It is designed in Firebase's console, not in our panel. There are two consoles, one for debug and one for release.
- Google still labels it Beta. Google retired another Firebase side product, Dynamic Links, on 2025-08-25.
- It has four fixed layouts, with colours set by hand.
- Its buttons open deep links, and 5 of our 7 link kinds do nothing today.
- Its views and clicks stay in Firebase unless we forward them into our own pipeline.
- iOS needs a Swift bridge like Remote Config's, which sat unreachable for months.
- Paid platforms (OneSignal, Braze, CleverTap) add an SDK, another company holding our users' identities, and one more
  console outside the panel.

Effort: about 1 week. But it fails the owner's first requirement: designed in our panel.

### Side by side

| | A1. HTML, data only | B. Blocks drawn by the app | C. Firebase In-App Messaging |
|:--|:--|:--|:--|
| Designed in our panel | Yes | Yes | No |
| Looks like the app: dark mode, large fonts | Built by hand, checked per screen | Free | Partly |
| Weight on the phone | A WebView | Small | An SDK |
| Works offline | Yes | Yes | Cached messages only |
| Taps in our analytics | Through a bridge | Automatic | Only if we forward them |
| Panel preview | Exact | Close, then a test phone | Firebase's own |
| First version | About 4 weeks | About 3 weeks | About 1 week |

**Recommended: B.** Add "open a page on invotick.com" as a button action, shown in the WebView dialog that already
exists. That covers the rare rich page, such as a help article or a campaign page, and that page gets no bridge.
If exact previews matter more to the owner than native quality, A1 is the safe way to do HTML. A2 is not.

## 3. What it could be used for (G1 > G3 > G2)

| Use | Goal | What the screen does | Fit |
|:--|:--|:--|:--|
| Onboarding and first-invoice nudges | G1 | Explains why their own business and client matter; reminds a guest who left a draft | Good. The forms stay native: a remote screen never collects business, client or item data |
| Guided recovery | G3 | After a refused sync: "Your invoices are safe on this phone. Sign in to keep backing them up." | Good, as a screen the server triggers. Sign-in itself stays native |
| "Your invoices are in account X" | G3 | "This phone was used with a•••@gmail.com. Your invoices are there." Buttons: Sign in, Not me | Rare: at most 1 real phone in 8 weeks. Android only |
| Announcements | G3 | The server move planned for the end of September; what is new in a release | Good and low-risk, so the right first use |
| Campaigns | G2 | "Send your invoice as a link, so your client can approve it" | Good, with a holdout. The app had recorded 0 approvals up to 2026-09-09 |
| Premium | Revenue | "Try premium" | Only as a button to the native paywall |

G1 is the biggest goal. 1,073 of 1,360 first-time devices (79%) did not create an invoice in the 8 days measured.
A screen cannot type their data for them. It can explain, remind, and send them to the right native screen.

### How the "account X" case would work
- **The server can tell, on Android.** The device id comes from the phone's ANDROID_ID, so it survives a reinstall.
  Our daily test phone kept one id across 207 guests in 8 weeks.
- When a guest's phone asks for its screens, the server checks `linked_device` for a registered account used earlier
  on the same phone. If there is one, it returns this screen with a masked email.
- **iPhones cannot be recognised after a reinstall, by design.** Their id lives and dies with the install (0053).
- **Show a masked email only** (a•••@gmail.com), as the support view masks emails (0091). A shared or second-hand
  phone must not learn a full address.
- If the guest has done real work since, signing in asks 0053's one question.
- **A new phone is invisible to the server.** A person with an account who taps GET STARTED on a new phone looks like
  any new user. Only the Landing screen's "Already have an account?" helps them.
- The 8 phones behind the count:
  - 6 are on the owner's confirmed list of test phones;
  - a 7th is a second id of our daily Pixel 7 Pro, seen 6 seconds apart from it, with a test-named account;
  - the 8th is a OnePlus with 5 registered accounts and 33 guests in 18 days, last seen 2026-08-28. That is not an
    ordinary user's pattern either.

## 4. Guardrails

1. **Who publishes.**
   - Admins only, which is 1 account today.
   - Every admin route needs `@RequireRole(ADMIN)`. Since 2026-09-14 the backend refuses a route with no role
     (deny-by-default, batch16), and a route test fails the build before such a route can ship.
   - Every publish is recorded: who, when, and which version.
   - A suggestion, new here and not existing practice: the panel sends every screen to your own test phones before
     anyone else sees it.
2. **Preview.**
   - In the panel: light and dark, a small and a large phone, and a large font (1.5×), in the app's colours from
     `m3.css`.
   - Then on a real phone. The `testing-devices` list must be brought up to date first.
3. **Targeting, set in the panel:**
   - platform, build range and country;
   - user type: guest, registered or premium;
   - first open or returning, and whether they have made an invoice;
   - the share of users who get it (rollout), and the share held out.
   - The phone checks the rules itself, so facts like "has an invoice" never leave the phone.
4. **Kill switch, at three levels:**
   - one screen: Pause in the panel, and phones drop it at their next fetch;
   - everything: a Remote Config text switch, `remote_screens_enabled`, on by default and read like the existing
     switches. The server can also answer with an empty list;
   - time: every screen has an end date, and the phone obeys it even offline.
5. **Offline, and failing safely.**
   - The app never waits for screens. It fetches them in the background at start, like the denylist.
   - A phone shows only a screen it holds whole, text and images. If anything is missing, or a block is one this
     build does not know, the screen is not shown at all. Never half a screen.
   - Never during the splash, never over an ad, and never over the first-open overlay (0033). At most one per session.
   - It always closes: a close button, back, and swipe.
6. **No passwords, no payments, no text fields.**
   - A remote screen has no text fields at all in the first version.
   - A web-looking page that asks for a password is what phishing looks like, and the server has no password to check
     against anyway.
   - Sign in opens the native screen, in 0098's "sign in again" mode. Premium opens the native paywall.
7. **Accessibility and dark mode.**
   - Colours come only from the app's colour roles, never raw colour codes, so dark mode follows by itself.
   - Every image needs a text description before the screen can be published.
   - One filled main button per screen, per the one-filled-element rule.
   - The panel checks contrast, and the test phone checks the 1.5× font (LAYOUT_RULES).
8. **Store rules, read on 2026-09-14.**
   - **Apple, App Review Guideline 2.5.2:** an app must be self-contained. It may not download or run code that adds
     or changes its features. In Apple's words, it may not "execute code which introduces or changes features or
     functionality of the app".
   - **Apple 4.7 and 4.7.2:** HTML5 and JavaScript "mini apps" are allowed, but the developer answers for them. The
     app may not expose native features to that software without Apple's permission.
   - **Apple 4.7.3:** no sharing of data or permissions with that software without the user's consent each time.
   - **Apple 4.2 and 4.2.2:** an app must be more than a repackaged website, and should not be mainly marketing.
     Remote screens must stay a small part of the app.
   - **Apple 5.1.1(vi):** developers whose apps secretly collect passwords or other private data are removed from the
     developer program.
   - **Apple's developer agreement, "Executable Code":** listed as 3.3.1(B) in the current contents. Its full text was
     read in a 2022 copy, where it is 3.3.2. Downloaded interpreted code, such as JavaScript, is allowed only if it
     does not change the app's main purpose, does not create a store for other code, and does not get around the
     system's security.
   - **Google Play, Device and Network Abuse:**
     - no self-updates outside Play, and no downloaded executable code (dex, JAR, .so files);
     - JavaScript run in a WebView is exempt;
     - but one listed violation is a WebView with a JavaScript bridge that loads untrusted content, such as `http://`
       pages or links from untrusted sources.
   - **Google Play, Payments:** paid in-app features must use Play's billing. An app may not steer users to another
     way to pay, including through in-app WebViews, buttons, links and messages.
   - **What this means for us:**
     - blocks sent as data (B) sit well inside all of these rules, and so does HTML sent as data with the renderer
       shipped in the app (A1);
     - a downloaded page with a bridge into the app (A2) is the only shape near a line;
     - premium can only ever be a button to the native paywall.
9. **Monetisation (AGENTS.md §1).**
   - A remote screen never removes, delays or replaces an ad placement.
   - Never during the splash, which holds the app-open ad and the 98% pass-through target (about 80% today).
   - Never at the save moment, where the interstitial shows.
   - A full screen covers the banner of the screen underneath for as long as it is open, and 0033 shows such a trade
     is the owner's call.
   - So measure banner impressions, ad revenue per session and splash pass-through for shown against held-out users,
     and bring any trade to the owner as a question.
10. **Privacy and storage.**
    - Nothing personal goes into a screen. The account-X email is masked, and sent only to a guest on that same phone.
    - Images are small (WebP), and deleted with the screen at its end date (invariant 3: storage is money).
    - The phone's endpoint reads a small table with an index, and the server holds nothing of it in memory.

## 5. Measurement (the rules in AGENTS-EVENTS.md)

- **The screen view is automatic.** A remote screen is a navigation route or a standard bottom sheet, so
  `screen_view` fires by itself (§1.2).
- **Its name carries the panel's key:** `remote_<key>`, for example `remote_whats_new_147`.
  - One shared name for every remote screen would put many screens under one id (§1.4).
  - The key is fixed when the screen is created and never renamed (§1.8). The readable name lives in Event Discovery.
- **Parameters on `screen_view`:** `screen_version`, `trigger` (`rule` or `server`), and `container` (`sheet` or
  `full`).
  - A missing value means unknown (§1.7).
  - From 1.4.6, `prev_screen` shows where the user came from.
- **Taps come from the app's own buttons,** so each is captured automatically as `tap:remote_<key>:<button_key>`, and
  the denylist governs it (§1.5).
  - The action it took (`open_screen`, `open_web` or `close`) is a parameter, not a new event (§1.1).
  - The denylist does not yet take effect in release builds. That was measured on 2026-09-13 and is still an open bug.
- **Closing** is the sheet's own close id, with `method` = `close_button`, `swipe` or `scrim_or_back` (0023). There is
  no separate "dismissed" event.
- **One new coded event, because nothing is pressed:** `remote_screen_not_shown`.
  - Its `reason` is `held_out`, `images_missing`, `unknown_block`, `ended`, `switched_off`, `already_shown`,
    `ad_on_screen` or `splash_on_screen`.
  - It is sent once per screen version per device per reason, like 0064.
  - It answers: did a published screen reach the people it targeted, and if not, why?
  - The `held_out` rows are what make the comparison group countable.
  - Each reason names what was seen, never why the user did anything (§1.14).
- **Outcomes need no new events.** Read the existing ones after a screen view, per device:
  - `login_success`, for recovery;
  - `invoice_created_success`, and G1's own proof, `invoice_shared_success` or `payment_added` (0006);
  - the `shared_invoice_*` events, for G2.
  - Then compare shown against held out.
- **The money side, in the same pass:** `ad_shown` and `ad_impression_value` per session, shown against held out.
- **The panel's preview sends nothing.** It is not a user.
- **Delivery gets a Health Centre card, not a page.** It shows:
  - the live screens;
  - the phones that fetched the list in the last 24 hours;
  - shown against not shown, by reason;
  - anything live past its end date.
- **Verify by counting** (§2.1): one tap is one row, checked in a Maestro flow.
- **The holdout** is a share of eligible users who deliberately do not see a campaign, so its effect can be measured
  against them.
  - 10% on campaigns.
  - None on recovery screens: holding back help from someone looking for their invoices would cost trust (G3).

## 6. A phased plan, after 1.4.6

A build shows remote screens only once it contains the part that draws them. So reach starts at zero at release and
grows with the rollout. In the last 7 days, 741 Android devices were still on 1.4.2, three releases old.

| Phase | What | Rough effort |
|:--|:--|:--|
| 0 | The owner's decisions below | None |
| 1 | **The pipe, and a first announcement.** Server: the table (its migration shipped alone first), the phone's endpoint, admin routes with a publish log, images with end dates, the Health Centre card. Panel: a Screens page with blocks, rules, a schedule, the preview, and "send to my test phone". App: fetch, cache, rules, sheet and full screen, six blocks, the first four to six destinations, the kill switch, the events | Server 4–5 days, panel 4–5 days, app 5–7 days, checking 2–3 days: **about 3 weeks** |
| 2 | **Screens the server triggers:** "this phone was used with a•••@gmail.com" (Android), and a sign-in nudge after a refused sync | **About 1 week** |
| 3 | **G1 and G2 tests with a 10% holdout:** an onboarding intro, a reminder for a guest with a draft, the link-and-approve campaign | 1–2 days per test, then 2–4 weeks of data |
| 4 | **Only if blocks prove too limiting:** A1, HTML sent as data and drawn by a renderer shipped in the app | **About 1–1.5 weeks** more |

- In phase 1 the server goes first, then the panel, then the app, in the release after 1.4.6.
- The first screen goes to our own phones, then to 10% of Android, then to everyone.

## The owner's decisions (later, one at a time)

- Build it, and when. Recommended: yes, after 1.4.6, in the phases above.
- How screens are drawn. Recommended: blocks drawn by the app (B), with "open a page on invotick.com" as a button.
- The first use. Recommended: an announcement, to our own phones first, then 10% of Android.
- The account-X screen. Recommended: phase 2, Android only, with a masked email. It is rare today.
- Who publishes. Recommended: admins only, always to your own test phone first, and every publish recorded.
- How often. Recommended: at most one remote screen per session, each once per device, never during the splash or
  over an ad.
- The holdout. Recommended: 10% on every campaign, none on recovery screens.
- Text fields. Recommended: none at all in the first version.

## Sources (read 2026-09-14)

- Apple App Review Guidelines (2.5.2, 4.2, 4.2.2, 4.7, 4.7.2, 4.7.3, 5.1.1):
  https://developer.apple.com/app-store/review/guidelines/
- Apple Developer Program License Agreement: https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
  The full clause was read in a 2022 filed copy:
  https://www.sec.gov/Archives/edgar/data/1581760/000119312522172365/d328928dex1036.htm
- Google Play, Device and Network Abuse: https://support.google.com/googleplay/android-developer/answer/9888379
- Google Play, Payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Firebase In-App Messaging: https://firebase.google.com/products/in-app-messaging and
  https://firebase.google.com/docs/in-app-messaging
- Firebase Remote Config limits and conditions: https://firebase.google.com/docs/remote-config/parameters
- Firebase Dynamic Links shutdown: https://firebase.google.com/support/dynamic-links-faq

**Code read** (app `invoice-kmp-app`, backend `invotick-apis`, panel `invotick-admin-panel`):
- **App, WebViews:** `core/ui/.../webview/InvoiceRendererPool.kt`, `InvoiceHtmlWebView.android.kt`,
  `InvoiceHtmlWebView.ios.kt`.
- **App, Remote Config:** `core/remote/.../RemoteConfigKeys.kt`, `RemoteSwitch.kt`.
- **App, navigation:** `composeApp/.../deeplink/DeepLinkHandler.kt`, `app/navigation/AppViewModel.kt` (`route`),
  `AppNavHost.kt` (`MainShellLaunchDestination`).
- **App, push and device ids:** `push/InvotickFcmService.kt`, `data/.../AndroidDeviceIdProvider.kt`,
  `IosDeviceIdProvider.kt`.
- **Backend:** `service/PushNotificationService.kt`, `model/auth/UserRole.kt`, `model/device/LinkedDevice.kt`.
- **Panel:** `app/m3.css`, `components/Sidebar.tsx`, `lib/api.ts`.
- **Web:** `renderer/vite.config.ts`, `renderer/main.tsx`.
