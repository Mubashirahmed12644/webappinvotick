"use client";

import { useSyncExternalStore } from "react";
import { platformFromUserAgent, type ViewerPlatform } from "@/lib/analytics/platform";
import { APP_STORE_URL, landingPlayUrl } from "@/lib/free-invoice/install";

/**
 * The two store badges under the landing's one CTA.
 *
 * ## Three things this component exists to get right
 *
 * 1. **The phone in the hand decides the order.** An Android phone sees Google Play first and
 *    larger; an iPhone sees the App Store first; a desktop sees them level, because neither is the
 *    one they are holding. The order is the whole point of putting two badges on a page where 88.5 %
 *    of the non-Pakistan traffic is a phone.
 * 2. **The platform is read in the BROWSER, never with `headers()`.** `/` is the page that ranks for
 *    "free invoice generator" and it must stay statically prerendered; one `headers()` call anywhere
 *    in its tree makes the whole page dynamic for the sake of two badges. So this reads
 *    `navigator.userAgent` through the SAME `platformFromUserAgent` the analytics route runs on the
 *    server — one implementation, two readers, so the order that rendered and the `viewer_platform`
 *    stamped on the event cannot drift.
 * 3. **The App Store badge is not a link, because there is no listing.** See `APP_STORE_URL`.
 *
 * ## Why the order arrives one frame late, and why that costs nothing
 *
 * `navigator` cannot be read during the server render, and reading it in the first client render
 * would be a hydration mismatch. So the badges render in the neutral desktop order and the effect
 * reorders them. **Both badges are always in the DOM at the same size**, and the reorder is CSS
 * `order` only — nothing appears, disappears or resizes, so there is no layout shift to pay for.
 */

type Store = "play" | "app_store";

/** The device does not change while the page is open, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

export function StoreBadges({ onBadgeClick }: { onBadgeClick?: (store: Store) => void }) {
  // `null` on the server and through hydration: "we have not looked yet", which renders as the
  // level desktop order. It is never a claim that the device IS a desktop (§1.7 — absent means
  // unknown). `useSyncExternalStore` is how React is told that the server and the client honestly
  // have different answers here, instead of setting state from an effect and re-rendering twice.
  const platform = useSyncExternalStore<ViewerPlatform | null>(
    noSubscription,
    () => platformFromUserAgent(navigator.userAgent),
    () => null,
  );

  const playFirst = platform === "android";
  const appStoreFirst = platform === "ios";
  // Level until we know, and level on a desktop — where neither store is the device in the hand.
  const emphasis = (mine: boolean) => (platform === null ? "level" : mine ? "primary" : "secondary");

  return (
    <div className="mt-5">
      {/* Centred on a phone, where the whole hero is centred; aligned with the headline from `lg`,
          where it is not. A centred label over a left-aligned column reads as a stray element. */}
      <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)] lg:text-start">
        Or get the app
      </p>
      {/* Stacked on a phone, side by side once there is room.
          `LAYOUT_RULES.md`: never assume two things fit side by side. Measured at 320 px with the
          16 px gutters, two badges leave 138 px each — and "Google Play" alone is 125 px of bold
          text at a 1.5× font scale, before the icon and the padding. So they stack, and the row
          starts at `sm` where there is 288 px of badge to share. */}
      <div className="mt-3 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-stretch sm:justify-center lg:justify-start">
        <PlayBadge emphasis={emphasis(playFirst)} onClick={() => onBadgeClick?.("play")} order={playFirst ? 1 : 2} />
        <AppStoreBadge emphasis={emphasis(appStoreFirst)} order={appStoreFirst ? 1 : 2} />
      </div>
    </div>
  );
}

type Emphasis = "primary" | "secondary" | "level";

/** One shell for both badges, so a live one and a dead one are the same object at the same size. */
const shell = (emphasis: Emphasis, live: boolean) =>
  [
    "flex min-h-[56px] items-center gap-3 rounded-[var(--radius-md)] border px-4 py-2.5 text-start transition",
    "sm:min-w-[190px]",
    // The store that belongs to the phone in the hand is the one that looks pressable: brand-tinted
    // edge and a lift. The other is present and legible, never dimmed to the point of looking
    // broken — a badge at half strength reads as "not available here", which on the live one would
    // be false.
    emphasis === "primary"
      ? "border-[var(--color-primary)]/40 bg-[var(--color-surface)] shadow-md ring-1 ring-[var(--color-primary)]/10"
      : "border-[var(--color-outline-variant)] bg-[var(--color-surface)]",
    live
      ? "hover:border-[var(--color-primary)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      : "cursor-default",
  ].join(" ");

function PlayBadge({ emphasis, onClick, order }: { emphasis: Emphasis; onClick: () => void; order: number }) {
  return (
    <a
      href={landingPlayUrl()}
      onClick={onClick}
      style={{ order }}
      className={shell(emphasis, true)}
      aria-label="Get Invotick on Google Play"
    >
      <PlayGlyph />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
          Get it on
        </span>
        {/* The store's name shrinks with the box rather than being cut. A clipped "Google Pla"
            would read as a broken page on the one element whose job is to look official. */}
        <span className="block truncate text-[15px] font-extrabold text-[var(--color-on-surface)]">
          Google Play
        </span>
      </span>
    </a>
  );
}

/**
 * Deliberately a `<div>`, not an `<a>` and not a disabled `<button>`.
 *
 * A disabled button is still announced as a button that failed; this is not a control at all yet.
 * It is a statement — *the iPhone app is coming* — so it is read as one, once, through its
 * `aria-label`, and it takes no focus that a keyboard user then has to escape from.
 */
function AppStoreBadge({ emphasis, order }: { emphasis: Emphasis; order: number }) {
  if (APP_STORE_URL) {
    // The day the listing exists. Nothing here is reachable today; it is written so that flipping
    // `APP_STORE_URL` is the whole change.
    return (
      <a href={APP_STORE_URL} style={{ order }} className={shell(emphasis, true)} aria-label="Get Invotick on the App Store">
        <AppleGlyph />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
            Download on the
          </span>
          <span className="block truncate text-[15px] font-extrabold text-[var(--color-on-surface)]">App Store</span>
        </span>
      </a>
    );
  }

  return (
    <div
      style={{ order }}
      className={shell(emphasis, false)}
      role="note"
      aria-label="Invotick for iPhone is coming soon to the App Store"
    >
      <AppleGlyph muted />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
          On the
        </span>
        <span className="block truncate text-[15px] font-extrabold text-[var(--color-on-surface-variant)]">
          App Store
        </span>
      </span>
      {/* The pill wraps under the label rather than squeezing it, so at a large font scale the
          store's name stays whole and this moves instead. */}
      <span className="shrink-0 rounded-full bg-[var(--color-surface-variant)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
        Soon
      </span>
    </div>
  );
}

/* --------------------------- glyphs ---------------------------
   Drawn inline so the badges carry no image request and inherit the page's own radius and
   spacing. ⚠️ These are OUR rendering of each store's mark; before this ships, the official
   badge artwork is the owner's call (Google's brand guidelines ask for the unmodified asset). */

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
      <path fill="#00C3FF" d="M3.6 1.8 13.8 12 3.6 22.2a1.5 1.5 0 0 1-.6-1.2V3c0-.5.23-.92.6-1.2z" />
      <path fill="#00E676" d="M13.8 12 3.6 1.8a1.5 1.5 0 0 1 1.5.03l11.7 6.64L13.8 12z" />
      <path fill="#FF3A44" d="M16.8 15.53 5.1 22.17a1.5 1.5 0 0 1-1.5.03L13.8 12l3 3.53z" />
      <path fill="#FFC107" d="M20.16 10.8c1.12.64 1.12 2.25 0 2.89l-3.36 1.9L13.8 12l3-3.53 3.36 2.33z" />
    </svg>
  );
}

function AppleGlyph({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-7 w-7 shrink-0 ${muted ? "text-[var(--color-outline)]" : "text-[var(--color-on-surface)]"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
