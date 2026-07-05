import type { MetadataRoute } from "next";

const SITE = "https://www.invotick.com";

// Landing + marketing are indexable; the login-gated app is not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/invoices", "/estimates", "/clients", "/products", "/expenses", "/payments", "/dashboard", "/settings", "/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
