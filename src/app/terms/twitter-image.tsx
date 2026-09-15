import { LEGAL_OG_SIZE, renderLegalOg } from "@/lib/legal-og";

export const alt = "Invotick Terms of Use";
export const size = LEGAL_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderLegalOg("Terms of Use", "The rules for using the Invotick apps and website.");
}
