import { User } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Chef de projet" };

export default function Page() {
  return (
    <ComingSoon
      title="Chef de projet"
      subtitle="Profil et préférences de l'utilisateur"
      icon={User}
      items={["Informations du profil", "Notifications", "Vues enregistrées", "Délégations"]}
    />
  );
}
