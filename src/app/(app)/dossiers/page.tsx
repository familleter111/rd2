import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Dossiers & revues" };

export default function Page() {
  return (
    <ComingSoon
      title="Dossiers & revues"
      subtitle="Dossiers réglementaires et comptes rendus de revues"
      icon={FileText}
      items={["Dossiers CTD", "Comptes rendus de revues", "Réserves et engagements", "Transferts industriels"]}
    />
  );
}
