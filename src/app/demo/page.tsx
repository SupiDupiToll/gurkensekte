import { redirect } from "next/navigation";
import { DEMO_BASE } from "@/lib/demo";

export default function DemoRootPage() {
  redirect(`${DEMO_BASE}/home`);
}
