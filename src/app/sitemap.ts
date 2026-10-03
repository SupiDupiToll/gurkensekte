import type { MetadataRoute } from "next";

function seitenUrl(): string {
  const raw = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://gurkensekte.de"
  ).trim().replace(/\/+$/, "");
  return raw || "https://gurkensekte.de";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const url = seitenUrl();
  const jetzt = new Date();
  return [
    { url: `${url}/`, lastModified: jetzt, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/spenden`, lastModified: jetzt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${url}/mitglieder`, lastModified: jetzt, changeFrequency: "weekly", priority: 0.8 },
  ];
}
