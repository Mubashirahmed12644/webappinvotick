"""
Generate Material 3 tonal palettes + both colour schemes from seed colours.

M3's "tone" is CIELAB L*, so a tonal palette is: take the seed's hue and chroma in LCh(ab),
hold them, sweep L* across the 13 tone stops, and pull chroma down until the result is inside
sRGB. That is the same construction Material Theme Builder performs; doing it here means the
palette is derived rather than hand-picked, and the on-pairs are contrast-correct by
construction (a 50-tone gap is >= 4.5:1 by definition of the system).
"""

M = [[0.4124564, 0.3575761, 0.1804375],
     [0.2126729, 0.7151522, 0.0721750],
     [0.0193339, 0.1191920, 0.9503041]]
MI = [[3.2404542, -1.5371385, -0.4985314],
      [-0.9692660, 1.8760108, 0.0415560],
      [0.0556434, -0.2040259, 1.0572252]]
WP = (0.95047, 1.0, 1.08883)


def s2l(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def l2s(c):
    v = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return v * 255.0


def hex2lab(h):
    h = h.lstrip("#")
    r, g, b = (s2l(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    x, y, z = (sum(M[i][j] * v for j, v in enumerate((r, g, b))) for i in range(3))
    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x / WP[0]), f(y / WP[1]), f(z / WP[2])
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def lab2rgb(L, a, bb):
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - bb / 200
    def fi(t):
        return t ** 3 if t ** 3 > 216 / 24389 else (116 * t - 16) * 27 / 24389
    x, y, z = fi(fx) * WP[0], fi(fy) * WP[1], fi(fz) * WP[2]
    rgb = [sum(MI[i][j] * v for j, v in enumerate((x, y, z))) for i in range(3)]
    return [l2s(c) for c in rgb]


def in_gamut(rgb):
    return all(-0.5 <= c <= 255.5 for c in rgb)


import math


def tone(seed_hex, t, chroma_override=None):
    """The colour at tone `t` on the tonal palette seeded by `seed_hex`."""
    L0, a0, b0 = hex2lab(seed_hex)
    C0 = math.hypot(a0, b0)
    h = math.atan2(b0, a0)
    C = C0 if chroma_override is None else chroma_override
    # Walk chroma down until sRGB can hold it. M3 does the same thing in HCT space.
    while C > 0:
        rgb = lab2rgb(t, C * math.cos(h), C * math.sin(h))
        if in_gamut(rgb):
            break
        C -= 0.5
    else:
        rgb = lab2rgb(t, 0, 0)
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def rotate(seed_hex, deg):
    """Same lightness/chroma, hue turned — how M3 derives tertiary from a single seed."""
    L, a, b = hex2lab(seed_hex)
    C, h = math.hypot(a, b), math.atan2(b, a) + math.radians(deg)
    rgb = lab2rgb(L, C * math.cos(h), C * math.sin(h))
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def rel_lum(h):
    h = h.lstrip("#")
    r, g, b = (s2l(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(f, b):
    a, c = rel_lum(f), rel_lum(b)
    hi, lo = max(a, c), min(a, c)
    return (hi + 0.05) / (lo + 0.05)


SEED = "#046EFB"          # the brand blue, unchanged — it is the product's identity
SEED_TERT = rotate(SEED, 60)
SEED_ERR = "#DC2626"
SEED_OK = "#059669"
SEED_WARN = "#F59E0B"
SEED_INFO = "#3B82F6"

# M3 chroma conventions: neutral is nearly grey, neutral-variant carries a hint of the seed.
NEU, NEUV, SEC_C = 4.0, 8.0, 16.0


def _fixed(p, sec, ter):
    """
    Material 3's FIXED accent roles — identical in light and dark, by definition.

    M3 defines these for elements that must keep one colour across both themes: a card or sheet that
    spans the two, a brand surface, anything where flipping would read as a different component
    rather than the same one at night. They are the spec's own answer to "this must not invert", and
    they are why inventing a `heroBanner` was never necessary.

    All twelve take LIGHT-theme tones and keep them: `*Fixed` = T90, `*FixedDim` = T80,
    `on*Fixed` = T10, `on*FixedVariant` = T30. That is also why every fixed surface is a light tone —
    there is no dark fixed role in Material 3, so a permanently DEEP brand block is not something the
    spec can express.
    """
    out = {}
    for name, f in (("primary", p), ("secondary", sec), ("tertiary", ter)):
        cap = name[0].upper() + name[1:]
        out[name + "Fixed"] = f(90)
        out[name + "FixedDim"] = f(80)
        out["on" + cap + "Fixed"] = f(10)
        out["on" + cap + "FixedVariant"] = f(30)
    return out


def scheme(dark: bool):
    p = lambda t, c=None: tone(SEED, t, c)
    ter = lambda t: tone(SEED_TERT, t)
    err = lambda t: tone(SEED_ERR, t)
    n = lambda t: tone(SEED, t, NEU)
    nv = lambda t: tone(SEED, t, NEUV)
    sec = lambda t: tone(SEED, t, SEC_C)
    fx = _fixed(p, sec, ter)

    if not dark:
        return dict(
            primary=p(40), onPrimary=p(100), primaryContainer=p(90), onPrimaryContainer=p(10),
            secondary=sec(40), onSecondary=sec(100), secondaryContainer=sec(90), onSecondaryContainer=sec(10),
            tertiary=ter(40), onTertiary=ter(100), tertiaryContainer=ter(90), onTertiaryContainer=ter(10),
            error=err(40), onError=err(100), errorContainer=err(90), onErrorContainer=err(10),
            background=n(98), onBackground=n(10),
            surface=n(98), onSurface=n(10),
            surfaceVariant=nv(90), onSurfaceVariant=nv(30),
            surfaceTint=p(40),
            inverseSurface=n(20), inverseOnSurface=n(95), inversePrimary=p(80),
            outline=nv(50), outlineVariant=nv(80),
            scrim=n(0),
            surfaceBright=n(98), surfaceDim=n(87),
            surfaceContainerLowest=n(100), surfaceContainerLow=n(96), surfaceContainer=n(94),
            surfaceContainerHigh=n(92), surfaceContainerHighest=n(90),
            **fx,
        )
    return dict(
        primary=p(80), onPrimary=p(20), primaryContainer=p(30), onPrimaryContainer=p(90),
        secondary=sec(80), onSecondary=sec(20), secondaryContainer=sec(30), onSecondaryContainer=sec(90),
        tertiary=ter(80), onTertiary=ter(20), tertiaryContainer=ter(30), onTertiaryContainer=ter(90),
        error=err(80), onError=err(20), errorContainer=err(30), onErrorContainer=err(90),
        background=n(6), onBackground=n(90),
        surface=n(6), onSurface=n(90),
        surfaceVariant=nv(30), onSurfaceVariant=nv(80),
        surfaceTint=p(80),
        inverseSurface=n(90), inverseOnSurface=n(20), inversePrimary=p(40),
        outline=nv(60), outlineVariant=nv(30),
        scrim=n(0),
        surfaceBright=n(24), surfaceDim=n(6),
        surfaceContainerLowest=n(4), surfaceContainerLow=n(10), surfaceContainer=n(12),
        surfaceContainerHigh=n(17), surfaceContainerHighest=n(22),
        **fx,
    )


def extended(dark: bool):
    """success / warning / info — M3 has no such roles, so they are built the same way."""
    out = {}
    for name, seed in (("success", SEED_OK), ("warning", SEED_WARN), ("info", SEED_INFO)):
        t = (lambda x: tone(seed, x))
        cap = name.capitalize()
        if not dark:
            out[name] = t(40); out["on" + cap] = t(100)
            out[name + "Container"] = t(90); out["on" + cap + "Container"] = t(10)
        else:
            out[name] = t(80); out["on" + cap] = t(20)
            out[name + "Container"] = t(30); out["on" + cap + "Container"] = t(90)
    return out


# ── Contrast levels ─────────────────────────────────────────────────────────────────────────
#
# Material 3's medium and high contrast schemes are not a filter over the standard one — they move
# the TONES. That distinction matters and cost a wrong first attempt here: solving only for the ON
# colour cannot work, because against a mid-tone base neither black nor white reaches 7:1. Light
# `primary` at T40 is #2655CA; white on it is 6.49 and black 2.30, and no third colour does better.
# The base has to move too.
#
# So each role carries three tones — standard, medium, high — and the accent bases DARKEN in light
# and LIGHTEN in dark as contrast rises, while their on-colours run the other way. Surfaces stay put:
# a high-contrast theme that also changed the paper colour would be a different theme, not a more
# legible one.
TONES = {
    #                       light: std, med, high      dark: std, med, high
    "primary":            ((40, 30, 22), (80, 86, 92)),
    "onPrimary":          ((100, 100, 100), (20, 14, 8)),
    "primaryContainer":   ((90, 92, 94), (30, 24, 18)),
    "onPrimaryContainer": ((10, 6, 0), (90, 95, 100)),
    "secondary":          ((40, 30, 22), (80, 86, 92)),
    "onSecondary":        ((100, 100, 100), (20, 14, 8)),
    "secondaryContainer": ((90, 92, 94), (30, 24, 18)),
    "onSecondaryContainer": ((10, 6, 0), (90, 95, 100)),
    "tertiary":           ((40, 30, 22), (80, 86, 92)),
    "onTertiary":         ((100, 100, 100), (20, 14, 8)),
    "tertiaryContainer":  ((90, 92, 94), (30, 24, 18)),
    "onTertiaryContainer": ((10, 6, 0), (90, 95, 100)),
    "error":              ((40, 30, 22), (80, 86, 92)),
    "onError":            ((100, 100, 100), (20, 14, 8)),
    "errorContainer":     ((90, 92, 94), (30, 24, 18)),
    "onErrorContainer":   ((10, 6, 0), (90, 95, 100)),
    "onSurface":          ((10, 5, 0), (90, 96, 100)),
    "onBackground":       ((10, 5, 0), (90, 96, 100)),
    "surfaceVariant":     ((90, 92, 94), (30, 26, 22)),
    "onSurfaceVariant":   ((30, 18, 8), (80, 92, 100)),
    "outline":            ((50, 38, 25), (60, 72, 85)),
    "outlineVariant":     ((80, 62, 42), (30, 46, 62)),
}

_SEED_OF = {
    "primary": (SEED, None), "onPrimary": (SEED, None),
    "primaryContainer": (SEED, None), "onPrimaryContainer": (SEED, None),
    "secondary": (SEED, SEC_C), "onSecondary": (SEED, SEC_C),
    "secondaryContainer": (SEED, SEC_C), "onSecondaryContainer": (SEED, SEC_C),
    "tertiary": (SEED_TERT, None), "onTertiary": (SEED_TERT, None),
    "tertiaryContainer": (SEED_TERT, None), "onTertiaryContainer": (SEED_TERT, None),
    "error": (SEED_ERR, None), "onError": (SEED_ERR, None),
    "errorContainer": (SEED_ERR, None), "onErrorContainer": (SEED_ERR, None),
    "onSurface": (SEED, NEU), "onBackground": (SEED, NEU),
    "surfaceVariant": (SEED, NEUV), "onSurfaceVariant": (SEED, NEUV),
    "outline": (SEED, NEUV), "outlineVariant": (SEED, NEUV),
}

# The FIXED roles carry the SAME tuple for light and dark — that identity is not a shortcut, it is
# the definition of the role. They still tighten as contrast rises, so a user who asks for high
# contrast gets it on a fixed surface too; what never happens is an inversion between themes.
for _n, _sd, _cr in (("primary", SEED, None), ("secondary", SEED, SEC_C), ("tertiary", SEED_TERT, None)):
    _cap = _n[0].upper() + _n[1:]
    for _role, _t in ((_n + "Fixed", (90, 92, 94)), (_n + "FixedDim", (80, 84, 88)),
                      ("on" + _cap + "Fixed", (10, 6, 2)), ("on" + _cap + "FixedVariant", (30, 24, 18))):
        TONES[_role] = (_t, _t)
        _SEED_OF[_role] = (_sd, _cr)


EXT_SEED = {"success": SEED_OK, "warning": SEED_WARN, "info": SEED_INFO}


def scheme_at(dark: bool, level: int):
    """The scheme at contrast `level` — 0 standard, 1 medium, 2 high."""
    s = scheme(dark)
    if level == 0:
        return s
    idx = 1 if dark else 0
    for role, tones in TONES.items():
        seed, chroma = _SEED_OF[role]
        s[role] = tone(seed, tones[idx][level], chroma)
    # primary moved, so the tint that tracks it moves with it
    s["surfaceTint"] = s["primary"]
    return s


def extended_at(dark: bool, level: int):
    """success / warning / info at the same contrast level, on the same tone schedule."""
    out = extended(dark)
    if level == 0:
        return out
    idx = 1 if dark else 0
    for name, seed in EXT_SEED.items():
        cap = name.capitalize()
        out[name] = tone(seed, TONES["primary"][idx][level])
        out["on" + cap] = tone(seed, TONES["onPrimary"][idx][level])
        out[name + "Container"] = tone(seed, TONES["primaryContainer"][idx][level])
        out["on" + cap + "Container"] = tone(seed, TONES["onPrimaryContainer"][idx][level])
    return out


if __name__ == "__main__":
    import json
    light, dark = scheme(False), scheme(True)
    el, ed = extended(False), extended(True)
    print(json.dumps({"light": light, "dark": dark, "extLight": el, "extDark": ed}, indent=1))

    print("\n--- contrast check: every on/base pair ---")
    worst = []
    for label, s, e in (("LIGHT", light, el), ("DARK", dark, ed)):
        pairs = [(k, "on" + k[0].upper() + k[1:]) for k in
                 ("primary", "secondary", "tertiary", "error", "background", "surface",
                  "primaryContainer", "secondaryContainer", "tertiaryContainer", "errorContainer",
                  "surfaceVariant")]
        allc = {**s, **e}
        pairs += [(k, "on" + k[0].upper() + k[1:]) for k in
                  ("success", "warning", "info", "successContainer", "warningContainer", "infoContainer")]
        for bg, fg in pairs:
            if bg in allc and fg in allc:
                r = contrast(allc[fg], allc[bg])
                worst.append((r, label, bg, allc[bg], allc[fg]))
    for r, label, bg, bgv, fgv in sorted(worst):
        flag = "FAIL" if r < 4.5 else ("aa " if r < 7 else "aaa")
        print(f"  {flag} {r:5.2f}:1  {label:5s} {bg:24s} {bgv} / {fgv}")
