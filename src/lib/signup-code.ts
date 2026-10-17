/**
 * The small rules of the web sign-up code step, kept out of the component so they can be tested.
 * Spec: `kaam/research/otp-wrong-email-spec.md` 2.3, 2.4, 6.2.
 */

export const CODE_LENGTH = 6;

/**
 * The backend's minimum gap between two code mails for an account is one minute for the first three
 * sends (then 5 and 15 minutes). The button waits the one minute, exactly as the app's does; a later,
 * longer wait is the server's own 429 sentence, shown as it is written.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** The help line appears this long after a code was sent, if no digit has been typed. */
export const HELP_AFTER_SECONDS = 30;

const DIGIT_BLOCKS: Array<[number, number]> = [
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Persian
  [0xff10, 0xff19], // full-width
];

/**
 * Only the digits of whatever was typed or pasted, as ASCII, at most six. "482 917", "482-917" and
 * a code in Arabic-Indic digits all become what the backend (ASCII only) accepts.
 */
export function digitsOnly(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x30 && cp <= 0x39) {
      out += ch;
      continue;
    }
    for (const [from, to] of DIGIT_BLOCKS) {
      if (cp >= from && cp <= to) {
        out += String(cp - from);
        break;
      }
    }
  }
  return out.slice(0, CODE_LENGTH);
}

/**
 * The key an address is remembered by: trimmed and lower-cased, the way the server compares it. The
 * server answers 409 "Email already exists" to a second sign-up for an address with an unfinished
 * sign-up, so the page asks no second time for an address it already signed up in this visit.
 */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Whole seconds left of a wait that started at `startedAtMs`, never below zero. */
export function secondsLeft(startedAtMs: number, nowMs: number, totalSeconds: number): number {
  const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, totalSeconds - Math.max(0, elapsed));
}

export function secondsSince(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/** The help appears once, at 30 s, and only if the person has not started typing the code. */
export function helpIsDue(secondsOnScreen: number, hasTypedADigit: boolean): boolean {
  return secondsOnScreen >= HELP_AFTER_SECONDS && !hasTypedADigit;
}

/** What the page says when the browser could not reach us at all (the app's own sentence). */
export const OFFLINE_SENTENCE = "Couldn't reach Invotick. Check your connection and try again.";
