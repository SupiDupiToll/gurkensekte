import { Suspense } from "react";
import { SpendenPage } from "@/components/SpendenPage";

export default function DemoSpendenPage() {
  return (
    <Suspense>
      <SpendenPage />
    </Suspense>
  );
}
