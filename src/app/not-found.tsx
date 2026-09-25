import { SearchX } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <AppShell>
      <Card className="mt-6">
        <EmptyState
          icon={SearchX}
          title="Page introuvable"
          description="Cette adresse ne correspond à aucun écran de l'Espace R&D."
          action={<LinkButton href="/vue-ensemble">Retour à la vue d&apos;ensemble</LinkButton>}
        />
      </Card>
    </AppShell>
  );
}
