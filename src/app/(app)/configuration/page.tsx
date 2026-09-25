import type { Metadata } from "next";
import { RolesView } from "@/components/config/roles-view";

export const metadata: Metadata = { title: "Configuration — rôles et accès" };

export default function Page() {
  return <RolesView />;
}
