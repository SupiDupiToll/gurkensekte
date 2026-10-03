import type { MetadataRoute } from "next";

function seitenUrl(): string {
  const raw = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://gurkensekte.de"
  ).trim().replace(/\/+$/, "");
  return raw || "https://gurkensekte.de";
}

export default function robots(): MetadataRoute.Robots {
  const url = seitenUrl();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${url}/sitemap.xml`,
  };
}
