import type { Metadata } from "next";
import { PrerequisitesView } from "@/components/project/prerequisites-view";

export const metadata: Metadata = { title: "Prérequis du projet" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/prerequis">) {
  const { code } = await params;
  const { demande, prerequis, importer } = await searchParams;
  const request = typeof demande === "string" ? demande : undefined;
  const selected = typeof prerequis === "string" ? prerequis : undefined;
  // `?prerequis=pr-cr-1&importer=exemple` opens the import dialog on its verification step (screen 13).
  const importFor = typeof importer === "string" && selected ? selected : undefined;
  return (
    <PrerequisitesView
      key={`${request ?? ""}-${selected ?? ""}-${importer ?? ""}`}
      slug={code}
      selectedId={selected}
      openRequestFor={request}
      importFor={importFor}
      example={importer === "exemple"}
    />
  );
}
