import { suggestEmailFix } from "./emailTypo.ts";

/**
 * When the "Did you mean ...?" chip is shown, and the ONE pause it may cause. Pure, so the rule is
 * tested rather than described (`email-suggestion-gate.test.ts`). It mirrors the app's sign-up view
 * model (spec `kaam/research/otp-wrong-email-spec.md` 2.2).
 *
 * - The chip is worked out when the person LEAVES the e-mail field.
 * - It disappears the moment the text changes: a stale chip must never offer an address different
 *   from the one typed.
 * - If Create account is pressed with a suggestion that was NEVER shown for this exact typed
 *   address, that press shows the chip and sends nothing. The next press sends the address as typed.
 *   This is the only pause: at most once per typed address, and only for addresses that match the
 *   rule.
 * - Pressing Create account with the chip on screen ignores it. An ignored address is never
 *   suggested again, so a person who meant `ahmed@gmial.com` is never nagged twice.
 * - Nothing here ever changes the typed address. Only the person's tap on the chip does.
 *
 * Addresses are compared as typed (trimmed, case kept): `Ahmed@Gmial.com` and `ahmed@gmial.com` are
 * two different strings the person might have looked at.
 */
export interface SuggestionGate {
  /** What the chip offers right now; null when no chip is on screen. */
  suggestion: string | null;
  /** Typed addresses the chip has been shown for. */
  shown: readonly string[];
  /** Typed addresses the person went past with the chip on screen. */
  ignored: readonly string[];
}

export const EMPTY_GATE: SuggestionGate = { suggestion: null, shown: [], ignored: [] };

const add = (list: readonly string[], value: string): readonly string[] =>
  list.includes(value) ? list : [...list, value];

/** The text changed: the chip goes away until the next time the field is left. */
export function gateOnEdit(gate: SuggestionGate): SuggestionGate {
  return gate.suggestion === null ? gate : { ...gate, suggestion: null };
}

/** The field was left. */
export function gateOnBlur(gate: SuggestionGate, typed: string): SuggestionGate {
  const t = typed.trim();
  if (gate.ignored.includes(t)) return { ...gate, suggestion: null };
  const suggestion = suggestEmailFix(t);
  if (suggestion === null) return { ...gate, suggestion: null };
  return { ...gate, suggestion, shown: add(gate.shown, t) };
}

/** Create account was pressed. `send` is false for the one pause. */
export function gateOnSubmit(
  gate: SuggestionGate,
  typed: string,
): { gate: SuggestionGate; send: boolean } {
  const t = typed.trim();
  const suggestion = suggestEmailFix(t);
  if (suggestion === null) return { gate: { ...gate, suggestion: null }, send: true };
  // Already looked at (the chip is up, or it was shown for this exact address before): carry on.
  if (gate.shown.includes(t)) {
    return { gate: { suggestion: null, shown: gate.shown, ignored: add(gate.ignored, t) }, send: true };
  }
  // Never seen: show it now and send nothing.
  return { gate: { ...gate, suggestion, shown: add(gate.shown, t) }, send: false };
}

/** The person tapped the chip; the caller puts the offered address in the field. */
export function gateOnAccept(gate: SuggestionGate): SuggestionGate {
  return { ...gate, suggestion: null };
}
