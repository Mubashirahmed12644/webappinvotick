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


# ─────────────────────────────────────────────────────────────────────────────
# CAM16 / HCT
#
# This file used to hold CIELAB hue. That was wrong: CIELAB's constant-hue lines
# bend for blues, so holding Lab hue while raising lightness walks a blue into
# violet. Measured on the brand seed — #046EFB is CAM16 hue 268.9°, and the Lab
# construction produced a dark `primary` at 281.4°: 12.5° of drift, which is the
# lavender the app was showing.
#
# Material 3's tone is CIELAB L*, but its hue and chroma are CAM16. That pairing
# is what HCT means. Verified against Material's own published baseline palette
# (seed #6750A4): every tone T0..T100 within 2.4/255, most within 1.
#
# Google's published BLUE set (#0B57D0 -> #A8C7FA) is NOT a reference: its own
# T80 sits 10.3° off its seed, i.e. hand-tuned, where #6750A4 holds hue to 0.8°.
# ─────────────────────────────────────────────────────────────────────────────

_WP100 = [95.047, 100.0, 108.883]
_MF = [[0.4124564, 0.3575761, 0.1804375],
       [0.2126729, 0.7151522, 0.0721750],
       [0.0193339, 0.1191920, 0.9503041]]
_MB = [[3.2404542, -1.5371385, -0.4985314],
       [-0.9692660, 1.8760108, 0.0415560],
       [0.0556434, -0.2040259, 1.0572252]]


def _xyz100(hexcolor):
    h = hexcolor.lstrip("#")
    # s2l takes 0..255 and l2s returns 0..255 — do not rescale around them.
    lin = [s2l(int(h[i:i + 2], 16)) * 100.0 for i in (0, 2, 4)]
    return [sum(_MF[i][j] * lin[j] for j in range(3)) for i in range(3)]


def _linrgb100(xyz):
    return [sum(_MB[i][j] * xyz[j] for j in range(3)) for i in range(3)]


def _in_gamut100(xyz):
    return all(-0.4 <= c <= 100.4 for c in _linrgb100(xyz))


def _hex_from_xyz100(xyz):
    out = []
    for c in _linrgb100(xyz):
        out.append(max(0, min(255, round(l2s(c / 100.0)))))
    return "#%02X%02X%02X" % tuple(out)


def _y_from_lstar(L):
    return 100.0 * ((L + 16.0) / 116.0) ** 3 if L > 8 else 100.0 * L / 903.2962962962963


def _lstar_from_y(y):
    t = y / 100.0
    return 116.0 * (t ** (1 / 3)) - 16.0 if t > 216 / 24389 else t * 903.2962962962963


def _cat(xyz):
    x, y, z = xyz
    return [0.401288 * x + 0.650173 * y - 0.051461 * z,
            -0.250268 * x + 1.204414 * y + 0.045854 * z,
            -0.002079 * x + 0.048952 * y + 0.953127 * z]


def _cat_inv(r, g, b):
    return [1.8620678 * r - 1.0112547 * g + 0.14918678 * b,
            0.38752654 * r + 0.62144744 * g - 0.00897398 * b,
            -0.01584150 * r - 0.03412294 * g + 1.04996444 * b]


def _adapt(v, fl):
    s = 1.0 if v >= 0 else -1.0
    a = (fl * abs(v) / 100.0) ** 0.42
    return s * 400.0 * a / (a + 27.13)


def _unadapt(v, fl):
    s = 1.0 if v >= 0 else -1.0
    a = abs(v)
    return s * 100.0 / fl * ((27.13 * a / (400.0 - a)) ** (1 / 0.42))


def _build_vc():
    """Material's default viewing conditions: D65, La from L*=50, average surround."""
    la = (200.0 / math.pi) * _y_from_lstar(50.0) / 100.0
    n = _y_from_lstar(50.0) / _WP100[1]
    z = 1.48 + math.sqrt(n)
    nbb = 0.725 / (n ** 0.2)
    w = _cat(_WP100)
    f = 0.8 + 2.0 / 10.0
    d = max(0.0, min(1.0, f * (1.0 - (1.0 / 3.6) * math.exp((-la - 42.0) / 92.0))))
    rgb_d = [d * _WP100[1] / c + 1.0 - d for c in w]
    k = 1.0 / (5.0 * la + 1.0)
    fl = 0.2 * (k ** 4) * 5.0 * la + 0.1 * ((1.0 - k ** 4) ** 2) * ((5.0 * la) ** (1 / 3))
    wa = [_adapt(c * dd, fl) for c, dd in zip(w, rgb_d)]
    aw = (40.0 * wa[0] + 20.0 * wa[1] + wa[2]) / 20.0 * nbb
    return dict(n=n, z=z, nbb=nbb, ncb=nbb, c=0.69, nc=1.0, rgb_d=rgb_d, fl=fl, aw=aw)


_VC = _build_vc()


def cam16_hc(hexcolor):
    """CAM16 hue in degrees, and CAM16 chroma."""
    r, g, b = _cat(_xyz100(hexcolor))
    a1, a2, a3 = (_adapt(v * d, _VC["fl"]) for v, d in zip((r, g, b), _VC["rgb_d"]))
    a = (11.0 * a1 - 12.0 * a2 + a3) / 11.0
    bb = (a1 + a2 - 2.0 * a3) / 9.0
    hdeg = math.degrees(math.atan2(bb, a)) % 360
    u = (20.0 * a1 + 20.0 * a2 + 21.0 * a3) / 20.0
    p2 = (40.0 * a1 + 20.0 * a2 + a3) / 20.0
    hr = math.radians(hdeg)
    et = 0.25 * (math.cos(hr + 2.0) + 3.8)
    J = 100.0 * (p2 * _VC["nbb"] / _VC["aw"]) ** (_VC["c"] * _VC["z"])
    t = (50000.0 / 13.0 * _VC["nc"] * _VC["ncb"] * et * math.hypot(a, bb)) / (u + 0.305)
    alpha = (t ** 0.9) * ((1.64 - 0.29 ** _VC["n"]) ** 0.73)
    return hdeg, alpha * math.sqrt(J / 100.0)


def _xyz_from_jch(J, C, hdeg):
    hr = math.radians(hdeg)
    alpha = 0.0 if J == 0 else C / math.sqrt(J / 100.0)
    t = (alpha / ((1.64 - 0.29 ** _VC["n"]) ** 0.73)) ** (1.0 / 0.9)
    ac = _VC["aw"] * ((J / 100.0) ** (1.0 / (_VC["c"] * _VC["z"])))
    p1 = 50000.0 / 13.0 * (0.25 * (math.cos(hr + 2.0) + 3.8)) * _VC["nc"] * _VC["ncb"]
    p2 = ac / _VC["nbb"]
    gamma = 23.0 * (p2 + 0.305) * t / (
        23.0 * p1 + 11.0 * t * math.cos(hr) + 108.0 * t * math.sin(hr))
    a, b = gamma * math.cos(hr), gamma * math.sin(hr)
    ra = (460.0 * p2 + 451.0 * a + 288.0 * b) / 1403.0
    ga = (460.0 * p2 - 891.0 * a - 261.0 * b) / 1403.0
    ba = (460.0 * p2 - 220.0 * a - 6300.0 * b) / 1403.0
    rc, gc, bc = (_unadapt(v, _VC["fl"]) for v in (ra, ga, ba))
    return _cat_inv(rc / _VC["rgb_d"][0], gc / _VC["rgb_d"][1], bc / _VC["rgb_d"][2])


def _solve(hue, chroma, t):
    """First in-gamut colour at CAM16 `hue`, walking chroma down, landing on L* = t."""
    yt = _y_from_lstar(t)
    c = chroma
    while c >= 0:
        lo, hi = 0.0, 100.0
        for _ in range(40):
            J = (lo + hi) / 2
            if _xyz_from_jch(J, c, hue)[1] < yt:
                lo = J
            else:
                hi = J
        xyz = _xyz_from_jch((lo + hi) / 2, c, hue)
        if _in_gamut100(xyz) and abs(_lstar_from_y(max(xyz[1], 0)) - t) < 0.6:
            return _hex_from_xyz100(xyz)
        c -= 0.4
    return _hex_from_xyz100([_WP100[0] * yt / 100, yt, _WP100[2] * yt / 100])


def tone(seed_hex, t, chroma_override=None):
    """The colour at tone `t` on the tonal palette seeded by `seed_hex`."""
    # Achromatic by definition, and CAM16 cannot be asked: alpha = C/sqrt(J/100)
    # diverges as J -> 0, so the solver returns residual chroma. It gave #000038.
    if t <= 0:
        return "#000000"
    if t >= 100:
        return "#FFFFFF"
    h, c = cam16_hc(seed_hex)
    return _solve(h, c if chroma_override is None else chroma_override, t)


def rotate(seed_hex, deg):
    """Same tone/chroma, hue turned — how M3 derives tertiary from a single seed.

    In CAM16 too. Rotating in Lab and reading the result back in CAM16 turned a
    nominal +60 into something else, because the two spaces disagree about where
    a hue is.
    """
    h, c = cam16_hc(seed_hex)
    t = round(_lstar_from_y(_xyz100(seed_hex)[1]))
    if t <= 0:
        return "#000000"
    if t >= 100:
        return "#FFFFFF"
    return _solve((h + deg) % 360, c, t)


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
