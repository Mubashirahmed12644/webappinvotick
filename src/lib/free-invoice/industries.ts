/**
 * The trades the onboarding asks about, and what each one actually changes.
 *
 * ## Why this step earns its place
 *
 * A question asked of a stranger has to pay for itself, or it is a step to leave at. This one pays
 * twice, on the very next screen and on the invoice itself:
 *
 * - **`symbol`** is the glyph drawn into the generated logo beside the initials, so the mark on the
 *   first invoice says what the business does.
 * - **`template`** is one of the ten real invoice designs this repo already ships
 *   (`templates.ts` → `/system-assets/header_N.png`), so the paper looks like the trade's paper
 *   without anybody opening the template picker.
 *
 * ## What this is NOT
 *
 * The design note that led to this step said we already ship **129 industry icons**. Searched for
 * on 2026-09-25 across both `Webinvotick` and `invoice-kmp-app`: **no such set exists** — the app
 * ships four drawables, none of them a trade icon, and no list of 129 anything appears in either
 * repo or in the project memory. So nothing here claims that number. This is a list written here,
 * with glyphs the platform already has, wired to the ten templates we really do ship. If the 129
 * icons turn up somewhere, this file is where they land and the step does not change shape.
 *
 * ## The rules
 *
 * - **`id` is the stored code space.** It is what goes on the draft and what the analytics schema
 *   permits, so renaming one would split its own history (AGENTS-EVENTS.md §1.8). Add freely,
 *   rename never.
 * - **`search` carries the words people actually type** for a trade whose formal name they would
 *   not — "sparky" for electrical, "chippy" for carpentry. A list you cannot find your own job in
 *   is a list that teaches the visitor this app is not for them.
 * - **`other` exists and is last.** A required question with no honest answer is a wall, and the
 *   trades below are a fraction of the trades there are.
 */
// No runtime import of `templates.ts` on purpose: Node's own test runner loads this file, and the
// repo's convention is that a module under test carries only type imports, which Node strips.
// So a trade names its design by id and the caller looks it up.

export interface Industry {
  /** Stored, and the analytics code space. Never renamed. */
  id: string;
  name: string;
  /** Drawn into the generated mark beside the initials. */
  symbol: string;
  /** One of `templates.ts`'s ids — the invoice design this trade opens with. */
  template: string;
  /** Extra words people type for this trade. The name itself is always searched. */
  search?: string[];
}

export const INDUSTRIES: Industry[] = [
  { id: "welding", name: "Welding & fabrication", symbol: "🔨", template: "workshop", search: ["metal", "steel", "fabricator", "welder"] },
  { id: "carpentry", name: "Carpentry & joinery", symbol: "🪚", template: "builder", search: ["chippy", "wood", "joiner", "furniture"] },
  { id: "construction", name: "Construction & building", symbol: "🏗️", template: "safety", search: ["builder", "contractor", "site", "mason", "concrete"] },
  { id: "electrical", name: "Electrical", symbol: "⚡", template: "safety", search: ["sparky", "electrician", "wiring", "rewire"] },
  { id: "plumbing", name: "Plumbing & heating", symbol: "🔧", template: "workshop", search: ["plumber", "boiler", "gas", "drain", "pipe"] },
  { id: "painting", name: "Painting & decorating", symbol: "🎨", template: "builder", search: ["painter", "decorator", "plaster"] },
  { id: "roofing", name: "Roofing", symbol: "🏠", template: "safety", search: ["roofer", "guttering", "tiles"] },
  { id: "cleaning", name: "Cleaning", symbol: "🧹", template: "business", search: ["cleaner", "housekeeping", "janitorial", "maid"] },
  { id: "landscaping", name: "Landscaping & gardening", symbol: "🌿", template: "creative", search: ["gardener", "lawn", "tree", "paving"] },
  { id: "automotive", name: "Automotive & repair", symbol: "🚗", template: "automotive", search: ["garage", "mechanic", "car", "bodyshop", "tyres"] },
  { id: "transport", name: "Transport & delivery", symbol: "🚚", template: "automotive", search: ["courier", "haulage", "moving", "logistics", "driver"] },
  { id: "it_services", name: "IT & computer services", symbol: "💻", template: "electronics", search: ["computer", "network", "support", "repair", "software"] },
  { id: "web_design", name: "Web & app development", symbol: "🖥️", template: "electronics", search: ["developer", "website", "coding", "programmer"] },
  { id: "design", name: "Design & branding", symbol: "✏️", template: "creative", search: ["graphic", "logo", "illustrator", "studio"] },
  { id: "photography", name: "Photography & video", symbol: "📷", template: "creative", search: ["photographer", "videographer", "wedding", "studio"] },
  { id: "marketing", name: "Marketing & advertising", symbol: "📣", template: "business", search: ["agency", "social media", "seo", "ads"] },
  { id: "consulting", name: "Consulting", symbol: "📊", template: "business", search: ["consultant", "advisory", "strategy", "coach"] },
  { id: "accounting", name: "Accounting & bookkeeping", symbol: "🧾", template: "business", search: ["accountant", "bookkeeper", "tax", "audit"] },
  { id: "legal", name: "Legal services", symbol: "⚖️", template: "business", search: ["lawyer", "solicitor", "advocate", "notary"] },
  { id: "real_estate", name: "Property & real estate", symbol: "🏢", template: "business", search: ["estate agent", "letting", "landlord", "rent"] },
  { id: "construction_eng", name: "Engineering", symbol: "📐", template: "workshop", search: ["engineer", "surveyor", "drawings", "structural"] },
  { id: "medical", name: "Medical & healthcare", symbol: "🩺", template: "medical", search: ["clinic", "doctor", "nurse", "dental", "physio"] },
  { id: "beauty", name: "Beauty & salon", symbol: "💇", template: "fashion", search: ["hair", "nails", "spa", "barber", "makeup"] },
  { id: "fitness", name: "Fitness & wellbeing", symbol: "🏋️", template: "fashion", search: ["trainer", "gym", "yoga", "pilates", "coach"] },
  { id: "education", name: "Education & tutoring", symbol: "📚", template: "creative", search: ["teacher", "tutor", "school", "training", "lessons"] },
  { id: "events", name: "Events & catering", symbol: "🎪", template: "creative", search: ["caterer", "wedding", "party", "hire", "decor"] },
  { id: "food", name: "Food & hospitality", symbol: "🍽️", template: "fashion", search: ["restaurant", "cafe", "coffee", "bakery", "chef", "takeaway", "catering"] },
  { id: "retail", name: "Retail & shop", symbol: "🛍️", template: "fashion", search: ["store", "boutique", "seller", "trading"] },
  { id: "wholesale", name: "Wholesale & trading", symbol: "📦", template: "business", search: ["supplier", "distributor", "import", "export"] },
  { id: "manufacturing", name: "Manufacturing", symbol: "🏭", template: "workshop", search: ["factory", "production", "assembly"] },
  { id: "agriculture", name: "Agriculture & farming", symbol: "🌾", template: "creative", search: ["farm", "crops", "livestock", "poultry"] },
  { id: "textiles", name: "Tailoring & textiles", symbol: "🧵", template: "fashion", search: ["tailor", "stitching", "garments", "embroidery"] },
  { id: "security", name: "Security services", symbol: "🛡️", template: "safety", search: ["guard", "cctv", "alarm", "surveillance"] },
  { id: "printing", name: "Printing & signage", symbol: "🖨️", template: "electronics", search: ["printer", "banner", "signs", "branding"] },
  { id: "hvac", name: "Air conditioning & HVAC", symbol: "❄️", template: "workshop", search: ["ac", "cooling", "ventilation", "refrigeration"] },
  { id: "salon_mobile", name: "Home & handyman services", symbol: "🧰", template: "builder", search: ["handyman", "odd jobs", "maintenance", "repairs"] },
  // Last, always. A required question with no honest answer is a wall.
  { id: "other", name: "Something else", symbol: "💼", template: "simple" },
];

export function industryById(id: string | undefined): Industry | undefined {
  if (!id) return undefined;
  return INDUSTRIES.find((i) => i.id === id);
}

/** Every id, for the analytics schema — so a value can never be stored that this list cannot name. */
export const INDUSTRY_IDS = INDUSTRIES.map((i) => i.id);

/** The id of the invoice design a trade opens with — Simple for a trade we do not know. */
export function templateIdForIndustry(id: string | undefined): string {
  return industryById(id)?.template ?? "simple";
}

/**
 * Trades matching what has been typed, best-first, or the whole list for an empty query.
 *
 * A name match outranks a keyword match, so typing "car" puts *Automotive & repair* above
 * *Carpentry* — the word is in one name and only in the other's keywords. `other` is pinned last
 * whatever happens: it is the answer for somebody who did not find theirs, so it must never sit
 * above the one they were about to find.
 */
export function searchIndustries(query: string): Industry[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return INDUSTRIES;
  const scored: Array<{ i: Industry; score: number }> = [];
  for (const i of INDUSTRIES) {
    if (i.id === "other") continue;
    const name = i.name.toLocaleLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if ((i.search ?? []).some((w) => w.includes(q))) score = 1;
    if (score >= 0) scored.push({ i, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const out = scored.map((s) => s.i);
  const other = INDUSTRIES.find((i) => i.id === "other");
  if (other) out.push(other);
  return out;
}
