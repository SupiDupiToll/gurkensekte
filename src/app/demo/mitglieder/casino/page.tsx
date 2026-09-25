import { CasinoPage } from "@/components/CasinoPage";

export default function DemoCasinoRoute() {
  return (
    <CasinoPage
      punkteApiBase="/demo/api/mitglieder/punkte"
      backHref="/demo/mitglieder"
    />
  );
}
