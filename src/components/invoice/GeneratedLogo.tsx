import { LOGO_BOX, generatedLogoLayout, generatedLogoTones } from "@/lib/generated-logo";

/**
 * The app's own logo for a business that has none — initials in a ring — drawn in the invoice's colour
 * (decision 0181). The same shape the app draws (drawCircularBadge), from the same three facts: the
 * business name, the invoice colour, and whether the header behind the tile is light.
 *
 * `size` is the tile's width on the 794 px sheet. The outline is 2 px of the sheet at any size.
 */
export function GeneratedLogo({ name, accent, headerLight = false, size }: { name: string; accent: string; headerLight?: boolean; size: number }) {
  const tones = generatedLogoTones(accent, headerLight);
  const l = generatedLogoLayout(name);
  const c = LOGO_BOX / 2;
  const stroke = (2 * LOGO_BOX) / size;
  const font = { fontFamily: "var(--font-nunito), sans-serif" } as const;
  return (
    <svg
      data-generated-logo=""
      viewBox={`0 0 ${LOGO_BOX} ${LOGO_BOX}`}
      width={size}
      height={size}
      role="img"
      aria-label={name}
      style={{ display: "block", flex: "none" }}
    >
      <rect width={LOGO_BOX} height={LOGO_BOX} fill={tones.tile} />
      <rect x={stroke / 2} y={stroke / 2} width={LOGO_BOX - stroke} height={LOGO_BOX - stroke} fill="none" stroke={tones.outline} strokeWidth={stroke} />
      <circle cx={c} cy={c} r={l.ring} fill="none" stroke={tones.ink} strokeWidth={l.ringWidth} />
      <circle cx={c} cy={c} r={l.disc} fill={tones.disc} />
      <text x={c} y={l.initials.baseline} textAnchor="middle" fontSize={l.initials.size} fontWeight={800} fill={tones.ink} style={font}>
        {l.initials.text}
      </text>
      {l.word.text && (
        <text x={c} y={l.word.baseline} textAnchor="middle" fontSize={l.word.size} fontWeight={700} fill={tones.ink} style={font}>
          {l.word.text}
        </text>
      )}
    </svg>
  );
}
