# 0074 — The phone-number name lookup is closed to everyone but admins

**Status:** decided by the owner on 2026-09-13 ("Abhi band karein"). It is being built on `fix/phone-lookup-closed`,
on top of batch4, and is not deployed.
**Related:** 0072, 0073, `memory/contacts-upload-privacy.md`, `memory/admin-panel-security-audit.md`.

## Context (read-only, 2026-09-13)

- **`GET /v1/lookup/phone?phone=` answered with no token and no limit.** It returned the name users most often saved
  for that number in their uploaded contact lists.
- **The app uploads each phone's whole contact list** (names, numbers, emails) through `IngestContactsUseCase`, live
  in 1.4.5:
  - the list is read once the user grants contacts in "add client";
  - the background sync worker then sends it, once per device;
  - the Contacts screen sends it again, forced, each time it opens.
- **The server holds 307,176 numbers.** 77,625 of them carry a name, and none of the named numbers belongs to a user.
  0 requests reached the route in 15 days.
- **The live app's Contacts "verify" calls it** with no token, inside `runCatching`.

## Decided

- **The route leaves `security.public-paths` and answers ADMIN only.** No token gets 401; any other caller gets 403.
- **The contact upload itself is unchanged.** Whether to take whole contact lists at all is a separate decision,
  and still open.

## Rejected

- **Leaving it open.** Anybody could turn numbers into names, for people who never used Invotick. It is also a Play
  user-data policy risk.
- **Building the narrowed version first** (sign-in, only the caller's own contacts, a daily cap). It needs an app
  release, and the door stays open until then. It can still be built later.
- **Only taking it off the public list.** Every app user holds a guest token, and a handler with no `@RequireRole`
  answers any signed-in caller, so it would stay open to anyone who mints one.

## Consequences

- **The Contacts "verify" shows no name** on every live build. It does not crash.
- **Open, the owner's:** whether the app should upload whole contact lists at all. The reasons given on 2026-07-19
  were invoice reach and a Truecaller-style idea, and legal review was flagged then.
