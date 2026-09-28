import { Suspense } from "react";
import { SpendenPage } from "@/components/SpendenPage";

export default function SpendenPageRoute() {
  // Suspense ist Pflicht, weil SpendenPage useSearchParams (?abgebrochen=1) nutzt.
  return (
    <Suspense>
      <SpendenPage />
    </Suspense>
  );
}
