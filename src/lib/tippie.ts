const TIPPIE_BASE = "https://pay.tippie.de/business-pay/3763235/EUR";

export function buildTippieLink({
  amountEur,
  reference,
}: {
  amountEur: number;
  reference: string;
}): string {
  const cents = Math.round(amountEur * 100);
  const encodedRef = encodeURIComponent(reference);
  return `${TIPPIE_BASE}/${cents}?reference=${encodedRef}`;
}
