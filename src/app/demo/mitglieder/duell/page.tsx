import { DuellPage } from "@/components/DuellPage";

export default function DemoDuellRoute() {
  return (
    <DuellPage
      punkteApiBase="/demo/api/mitglieder/punkte"
      duellApiBase="/demo/api/mitglieder/duell"
      backHref="/demo/mitglieder"
    />
  );
}
