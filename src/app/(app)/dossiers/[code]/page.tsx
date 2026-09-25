import type { Metadata } from "next";
import { DossierStructure } from "@/components/dossiers/dossier-structure";

export const metadata: Metadata = { title: "Dossier CTD" };

export default async function Page({ params }: PageProps<"/dossiers/[code]">) {
  const { code } = await params;
  return <DossierStructure slug={code} />;
}
