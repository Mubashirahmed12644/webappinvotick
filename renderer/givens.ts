// Offline override of @/lib/givens for the bundled renderer: the web app serves the footer brand
// logo from /public (a URL the self-contained offline bundle can't reach), so inline it instead.
import logo from "./invotick-logo.png";

export const BRAND_LOGO: string = logo;
