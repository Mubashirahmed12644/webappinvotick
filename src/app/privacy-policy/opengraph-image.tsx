import { LEGAL_OG_SIZE, renderLegalOg } from "@/lib/legal-og";

export const alt = "Invotick Privacy Policy";
export const size = LEGAL_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderLegalOg("Privacy Policy", "What Invotick collects, why, who it is shared with, and your choices.");
}
