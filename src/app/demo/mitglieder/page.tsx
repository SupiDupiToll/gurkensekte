import { MitgliederDashboard } from "@/components/MitgliederDashboard";
import { DEMO_USER } from "@/lib/demo";

export default function DemoMitgliederPage() {
  return (
    <MitgliederDashboard
      user={DEMO_USER}
      isDemo
      punkteApiBase="/demo/api/mitglieder/punkte"
    />
  );
}
