// Run: npm test
//
// The generated logo in the invoice's colour (decision 0181). The tone table below is the same table, hex for
// hex, as the app's GeneratedLogoTonesTest (core/ui): the app draws the Create Invoice card's logo with
// M3Palette.tone and this renderer draws the invoice's with `tone`, so a hex that differs between the two is
// a card that does not match the invoice it heads.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GENERATED_LOGO_MARK,
  LIGHT_HEADER_IDS,
  contrast,
  generatedLogoLayout,
  generatedLogoTones,
  isGeneratedLogo,
  isLightHeader,
  logoInitials,
  logoWord,
  tone,
} from "./generated-logo.ts";
import { templateLook } from "./render-look.ts";

// seed → tones 35, 80, 90, 95. Every seeded template accent, the renderer's default, a Customize colour,
// and the app's brand seed.
const TONES: Record<string, [string, string, string, string]> = {
  "#0D4DC0": ["#0349BD", "#B3C5FF", "#DBE1FF", "#EEF0FF"],
  "#9F4200": ["#8F3600", "#FFB692", "#FFDBCB", "#FFEDE6"],
  "#9269FF": ["#5E2EC8", "#CFBDFF", "#E8DDFF", "#F5EEFF"],
  "#95C7D5": ["#255965", "#9CCEDD", "#B8EBF9", "#D7F6FF"],
  "#663E37": ["#714840", "#F2B9AF", "#FFDAD4", "#FFEDEA"],
  "#715C24": ["#645019", "#E0C481", "#FDE09A", "#FFEFCF"],
  "#50535A": ["#4F5259", "#C4C6CE", "#E0E2EB", "#EFF0F9"],
  "#01224C": ["#39527F", "#AEC7FA", "#D7E3FF", "#ECF0FF"],
  "#AD4800": ["#903500", "#FFB692", "#FFDBCB", "#FFEDE6"],
  "#702D3D": ["#823C4C", "#FFB1BF", "#FFD9DE", "#FFECEE"],
  "#2E7D32": ["#076019", "#88D982", "#A3F69C", "#C7FFBE"],
  "#046EFB": ["#004CB7", "#B0C6FF", "#D9E2FF", "#EDF0FF"],
};

/** The accent of every seeded template, as TemplateSeeder writes it — Modern Minimal and Simple White included. */
const SEEDED_ACCENTS = ["#0D4DC0", "#9F4200", "#9269FF", "#95C7D5", "#663E37", "#715C24", "#50535A", "#01224C", "#AD4800", "#702D3D"];

test("tones match the app's M3Palette.tone, hex for hex", () => {
  for (const [seed, expected] of Object.entries(TONES)) {
    assert.deepEqual([35, 80, 90, 95].map((t) => tone(seed, t)), expected, seed);
  }
});

test("the mark's colours are T35 ink and ring, T95 tile, T90 disc, T80 outline", () => {
  const t = generatedLogoTones("#AD4800", false);
  assert.deepEqual(t, { ink: "#903500", tile: "#FFEDE6", disc: "#FFDBCB", outline: "#FFB692" });
});

test("on a light header the outline is drawn in the ink's tone, T35", () => {
  assert.equal(generatedLogoTones("#AD4800", true).outline, "#903500");
});

test("the ink reads at 4.5:1 or better on the tile and on the disc, for every seeded accent", () => {
  for (const accent of [...SEEDED_ACCENTS, "#2E7D32"]) {
    const t = generatedLogoTones(accent, false);
    assert.ok(contrast(t.ink, t.tile) >= 4.5, `${accent}: ink ${t.ink} on tile ${t.tile} = ${contrast(t.ink, t.tile).toFixed(2)}`);
    assert.ok(contrast(t.ink, t.disc) >= 4.5, `${accent}: ink ${t.ink} on disc ${t.disc} = ${contrast(t.ink, t.disc).toFixed(2)}`);
  }
});

test("the two new template accents carry white table text at 4.5:1 or better", () => {
  for (const accent of ["#9F4200", "#715C24"]) {
    assert.ok(contrast(accent, "#ffffff") >= 4.5, `${accent} ${contrast(accent, "#ffffff").toFixed(2)}`);
  }
});

test("a logo is generated only when its address carries the mark", () => {
  assert.equal(isGeneratedLogo(`/uploads/9f1c.jpg${GENERATED_LOGO_MARK}`), true);
  assert.equal(isGeneratedLogo("https://gw.invotick.com/uploads/9f1c.jpg#generated-logo"), true);
  // An upload, an old business's baked picture, a snapshot's data URI: all pictures, never recoloured.
  assert.equal(isGeneratedLogo("/uploads/9f1c.jpg"), false);
  assert.equal(isGeneratedLogo("data:image/webp;base64,AAAA"), false);
  assert.equal(isGeneratedLogo(null), false);
  assert.equal(isGeneratedLogo(undefined), false);
});

test("initials and word follow the app's policy", () => {
  const cases: [string, string, string][] = [
    ["Tariq Electronics", "TE", "Tariq"],
    ["Karachi Builders", "KB", "Karachi"],
    ["Al-Noor", "AN", "Al-Noor"],
    ["TouchPedia", "TP", "TouchPedia"],
    ["Touchpedia", "TO", "Touchpedia"],
    ["ABC", "AB", "ABC"],
    ["x", "XX", "x"],
    ["  Royal Corporation Pvt Ltd ", "RC", "Royal"],
    ["tech_hub", "TH", "tech_hub"],
    ["", "--", ""],
  ];
  for (const [name, initials, word] of cases) {
    assert.equal(logoInitials(name), initials, name);
    assert.equal(logoWord(name), word, name);
  }
});

test("the text always fits: wide initials and a long word come out smaller, never wider", () => {
  const R = 240;
  const narrow = generatedLogoLayout("Il");
  const wide = generatedLogoLayout("Mega Works");
  assert.ok(wide.initials.size < narrow.initials.size);
  assert.ok(generatedLogoLayout("Supercalifragilisticexpialidocious Ltd").word.size < generatedLogoLayout("Al Noor").word.size);
  // Never above the initials, and never past the disc.
  for (const n of ["Tariq Electronics", "W", "Zainab Fashion House", "زینب فیشن"]) {
    const l = generatedLogoLayout(n);
    assert.ok(l.word.size <= l.initials.size * 0.6 + 1e-9, n);
    assert.ok(l.initials.size <= R * 2, n);
    assert.ok(l.word.baseline < 300 + R, n);
  }
});

test("the light headers are known by id, the same three the app holds", () => {
  assert.deepEqual([...LIGHT_HEADER_IDS].sort(), [
    "00000000-0000-0000-0002-000000000002",
    "00000000-0000-0000-0002-000000000006",
    "00000000-0000-0000-0002-000000000007",
  ]);
  assert.equal(isLightHeader("00000000-0000-0000-0002-000000000007"), true);
  assert.equal(isLightHeader("00000000-0000-0000-0002-000000000004"), false);
  assert.equal(isLightHeader(null), false);
  assert.equal(templateLook({ headerId: "00000000-0000-0000-0002-000000000007" }).headerLight, true);
  assert.equal(templateLook({ headerId: "00000000-0000-0000-0002-000000000001" }).headerLight, false);
});
