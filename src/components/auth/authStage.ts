/**
 * The page wrapper of the sign-up form and its code step.
 *
 * Both used to be vertically centred (`items-center`). Centring moves everything when the content
 * grows: the "Did you mean ...?" chip lifted the whole form 26 px as it appeared (the Create account
 * button slid under the finger that was about to press it), and the 30 s help block lifted the six
 * boxes. The spec asks for no jump of anything above what appears (`otp-wrong-email-spec.md` 2.4).
 *
 * So the column is anchored to the top instead, at the same place a centred empty form sat (a 40rem
 * form on a taller screen), and growth only pushes things down. The same top on both steps also means
 * the logo does not move when the form swaps for the code step.
 */
export const AUTH_STAGE_CLASS =
  "flex min-h-screen items-start justify-center px-6 pb-6 pt-[max(1.5rem,calc((100svh-40rem)/2))]";
