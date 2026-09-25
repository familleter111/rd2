import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Configuration" };

export default function Page() {
  return (
    <ComingSoon
      title="Configuration"
      subtitle="Modèles de parcours, référentiels et droits"
      icon={Settings}
      items={["Modèles de parcours", "Référentiels produits", "Rôles et habilitations", "Circuits de validation"]}
    />
  );
}
