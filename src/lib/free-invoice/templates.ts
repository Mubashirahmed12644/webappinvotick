// Invoice design templates — the same header artwork the mobile app ships
// (bundled at /system-assets/header_N.png). A template = header image + a theme
// colour for the items table & totals band. "Simple" has no header, so the
// landing page's default render pulls zero template images (kept SEO-light).
export interface InvoiceTemplate {
  id: string;
  name: string;
  headerImage: string | null;
  color: string;
  titleColor?: string | null;
}

export const TEMPLATES: InvoiceTemplate[] = [
  { id: "simple", name: "Simple", headerImage: null, color: "#0D4DC0" },
  { id: "business", name: "Business", headerImage: "/system-assets/header_4.png", color: "#0D4DC0" },
  { id: "automotive", name: "Automotive", headerImage: "/system-assets/header_8.png", color: "#1D4ED8" },
  { id: "workshop", name: "Workshop", headerImage: "/system-assets/header_1.png", color: "#455A64" },
  { id: "safety", name: "Construction", headerImage: "/system-assets/header_7.png", color: "#B45309" },
  { id: "builder", name: "Builder", headerImage: "/system-assets/header_5.png", color: "#9A3412" },
  { id: "medical", name: "Medical", headerImage: "/system-assets/header_6.png", color: "#0E7C86" },
  { id: "electronics", name: "Electronics", headerImage: "/system-assets/header_3.png", color: "#E8590C" },
  { id: "creative", name: "Creative", headerImage: "/system-assets/header_2.png", color: "#0F766E", titleColor: "#1c1b1f" },
  { id: "fashion", name: "Fashion", headerImage: "/system-assets/header_9.png", color: "#BE185D" },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

export function templateById(id: string): InvoiceTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}
