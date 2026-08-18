export const DEMO_BASE = "/demo";

export function demoPath(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path === "/") return `${DEMO_BASE}/home`;
  return `${DEMO_BASE}${path}`;
}

export const DEMO_USER = {
  displayName: "Demo-Mitglied",
  primaryEmail: "demo@gurkensekte.de",
  signedUpAt: "2024-06-01T00:00:00.000Z",
};
