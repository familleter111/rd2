import type { Metadata } from "next";
import { LotsView } from "@/components/project/lots-view";

export const metadata: Metadata = { title: "Lots et échantillons" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/formules/lots">) {
  const { code } = await params;
  const { creer, formule, lot, onglet } = await searchParams;
  return (
    <LotsView
      key={`${typeof lot === "string" ? lot : "all"}-${typeof onglet === "string" ? onglet : ""}`}
      slug={code}
      openCreate={creer === "1"}
      presetFormula={typeof formule === "string" ? formule : undefined}
      initialLot={typeof lot === "string" ? lot : undefined}
      initialTab={typeof onglet === "string" ? onglet : undefined}
    />
  );
}
