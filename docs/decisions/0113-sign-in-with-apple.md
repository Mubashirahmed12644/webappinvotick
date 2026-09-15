# 0113 — Sign in with Apple

- **Date:** 2026-09-15
- **Status:** decided by the owner on 2026-09-15: *"Apple login bana do"*. Built on branches; not merged, not deployed,
  not released.
  - Backend `feat/sign-in-with-apple-migration` `19e9884` (the migration alone, on top of 0111's).
  - Backend `feat/sign-in-with-apple`, on `feat/account-deletion`: tests `e18184c` (31 compile errors first), code
    `b767cbc`, 0099 test `c4c334f`. Full suite 1086/1086.
  - App `feat/146-sign-in-with-apple`, on `feat/146-delete-account`: tests `a8b68154` (did not compile first), code
    `cd017d46`. domain 52/52, data 319/319, feature:auth 18/18, composeApp 12/12. Android and Kotlin iOS compiles pass;
    xcodebuild on the iPhone 17 Pro simulator: BUILD SUCCEEDED.
  - **Extends 0099:** an Apple sign-in lets a removed phone back in, as Google does. This is the owner's to confirm.
- **Decision:** the iPhone app offers Sign in with Apple, above Google, and the server checks Apple's identity token and
  treats the sign-in exactly as a Google sign-in; deleting such an account revokes its Apple sign-in, as Apple requires.
- **Related:** App Review guideline 4.8 (an app that offers Google sign-in must offer Sign in with Apple) · 0111 (an
  account can be deleted; Apple requires the revoke then) · 0053 (guest work joins an account) · 0099 (a removed phone
  comes back on a sign-in that proves the account).

## Context

- The iOS sign-in screen offers "Continue with Google" and nothing from Apple, so App Review refuses it under 4.8.
- The server already has one public sign-in route for Google, `/v1|v2/auth/social-login`, and `AuthProvider.APPLE`
  already exists, with no verifier behind it.

## Decided

**The app (iPhone only).**
- Apple's own button, "Continue with Apple" (`ASAuthorizationAppleIDButton`), sits above Google: black in light mode,
  white in dark.
- Android and the desktop do not show it (`appleSignInOffered = false`).
- For every sign-in the phone makes a fresh random nonce and gives Apple its SHA-256. Apple writes that into the
  identity token.
- The phone sends the token, the raw nonce, Apple's one-time code, and the name. Apple gives the app the name on the
  first sign-in only, and never puts it in the token.
- The entitlement `com.apple.developer.applesignin` is added to `iosApp.entitlements`.

**The server: no new route.** `provider = "apple"` on the existing, already public social sign-in.
`AppleTokenVerifier` takes a token only when:
- one of Apple's published keys signed it (`https://appleid.apple.com/auth/keys`, found by `kid`, kept an hour, and
  fetched once more for a key Apple has just rotated in, at most once a minute);
- Apple issued it, for our bundle id `invotick.invoicemaker`, and it has not expired;
- it carries the SHA-256 of this sign-in's nonce. A sign-in without a nonce is refused.
- A refused token is 401; Apple's keys out of reach is 503.

**From there it is Google's path.**
- A known Apple identity signs in to its account. An email already on an account links to it. Otherwise a new account
  is made, named from the request. The email may be Apple's private relay address.
- The same guest-work question applies (0053: the answer carries `newAccount`).
- Apple proves the account as Google does, so it lets a phone its account removed back in (0099, `SignInProof.APPLE`).
- A deleted account asks "bring it back?" first (0111).

**The revoke Apple requires.**
- After a sign-in has passed the deleted-account question, the server trades Apple's one-time code for a refresh token.
  It shows Apple a client secret: an ES256 token signed with the Sign in with Apple key.
- The refresh token is kept on the Apple sign-in's own `user_identities` row (new nullable column
  `provider_refresh_token`).
- When the account is deleted (0111), the server revokes it at Apple (`/auth/revoke`) and forgets it. This runs after
  the closing has been committed, so Apple is never asked while a database connection is held.
- The erase deletes the row 30 days later.

**The key is the owner's.** Team id, key id and the `.p8` go in `.env.prod`, never in git:
`APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` (one line, its line breaks written as `\n`).
- Without them, sign-in still works.
- But no refresh token is kept, so a deleted account's Apple sign-in cannot be revoked. The log says so each time.

## Rejected

- **A new Apple-only route.** The social sign-in already does everything except check the token, and it is already on
  the reviewed public list. A second route would be a second door to review.
- **A drawn button with our own Apple logo.** Apple's guidelines ask for Apple's button; the native one carries its
  proportions and logo.
- **Trading the one-time code before the deleted-account question.** A "bring it back" needs the code, and a code can
  be used only once.
- **Revoking inside the closing transaction.** It would hold a database connection while Apple answers, and would revoke
  for a closing that then rolled back.
- **Accepting a token without the nonce.** Such a token proves nothing about this sign-in: one taken from another app's
  sign-in would work.

## Consequences

- **Deploy order** comes after 0111's:
  1. the migration `V20260915_02`, which must reach production after `V20260915_01`;
  2. then the server code;
  3. then the iOS build.
- **The owner's steps** in Apple Developer, before an iOS build can be signed:
  1. Identifiers → App ID `invotick.invoicemaker` → enable **Sign in with Apple** (primary App ID) → save. Xcode's
     automatic signing then refreshes the provisioning profile.
  2. Keys → **+** → name it, tick **Sign in with Apple** → Configure → choose `invotick.invoicemaker` → Continue →
     Register → **Download the `.p8` once** (Apple never shows it again). Note the **Key ID**.
  3. Membership details → note the **Team ID**.
  4. Put the three in `.env.prod` (the key's text as one line, with `\n` for its line breaks), then recreate the app
     container.
- **Android is unchanged.**
- **Not built:**
  - Sign in with Apple on the website;
  - Apple's server-to-server notifications (a person who stops using Apple ID with the app).
