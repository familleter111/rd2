import type { Metadata } from "next";
import { DossierExport } from "@/components/dossiers/dossier-export";

export const metadata: Metadata = { title: "Exporter le dossier" };

export default async function Page({ params }: PageProps<"/dossiers/[code]/export">) {
  const { code } = await params;
  return <DossierExport slug={code} />;
}
