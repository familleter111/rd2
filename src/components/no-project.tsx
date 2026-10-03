import { Folder, Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";

/** Page of a module opened while the workspace has no project yet. */
export function NoProject({ title, subtitle, description }: { title: string; subtitle: string; description: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mt-6">
        <EmptyState
          icon={Folder}
          title="Aucun projet pour le moment"
          description={description}
          action={
            <LinkButton href="/projets/nouveau" icon={<Plus className="h-5 w-5" />}>
              Créer un projet
            </LinkButton>
          }
        />
      </Card>
    </>
  );
}
